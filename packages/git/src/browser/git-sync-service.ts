/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from "inversify";
import { MessageService, Emitter, Event } from "@theia/core";
import { QuickOpenService, QuickOpenItem, QuickOpenMode, ConfirmDialog } from "@theia/core/lib/browser";
import { GitRepositoryTracker } from "./git-repository-tracker";
import { Git, Repository, WorkingDirectoryStatus } from "../common";

@injectable()
export class GitSyncService {

    @inject(Git)
    protected readonly git: Git;

    @inject(GitRepositoryTracker)
    protected readonly repositoryTracker: GitRepositoryTracker;

    @inject(MessageService)
    protected readonly messageService: MessageService;

    @inject(QuickOpenService)
    protected readonly quickOpenService: QuickOpenService;

    protected readonly onDidChangeEmitter = new Emitter<void>();
    readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

    protected fireDidChange(): void {
        this.onDidChangeEmitter.fire(undefined);
    }

    protected syncing = false;
    isSyncing(): boolean {
        return this.syncing;
    }
    setSyncing(syncing: boolean): void {
        this.syncing = syncing;
        this.fireDidChange();
    }

    canSync(): boolean {
        if (this.isSyncing()) {
            return false;
        }
        const status = this.repositoryTracker.selectedRepositoryStatus;
        return !!status && !!status.branch && !!status.upstreamBranch;
    }
    async sync(): Promise<void> {
        const repository = this.repositoryTracker.selectedRepository;
        if (!this.canSync() || !repository) {
            return;
        }
        this.setSyncing(true);
        try {
            await this.git.fetch(repository);
            let status = await this.git.status(repository);
            this.setSyncing(false);

            const method = await this.getSyncMethod(status);
            if (method === undefined) {
                return;
            }
            this.setSyncing(true);
            if (method === 'pull-push' || method === 'rebase-push') {
                await this.git.pull(repository, {
                    rebase: method === 'rebase-push'
                });
                status = await this.git.status(repository);
            }
            if (this.shouldPush(status)) {
                await this.git.push(repository, {
                    force: method === 'force-push'
                });
            }
        } catch (e) {
            this.error(e);
        } finally {
            this.setSyncing(false);
        }
    }
    protected async getSyncMethod(status: WorkingDirectoryStatus): Promise<GitSyncService.SyncMethod | undefined> {
        if (!status.upstreamBranch || !status.branch) {
            return undefined;
        }
        const { branch, upstreamBranch } = status;
        if (!this.shouldPull(status) && !this.shouldPush(status)) {
            this.messageService.info(`${branch} is already in sync with ${upstreamBranch}`);
            return undefined;
        }
        const methods: {
            label: string
            warning: string
            value: GitSyncService.SyncMethod
        }[] = [{
            label: `Pull and push commits from and to '${upstreamBranch}'`,
            warning: `This action will pull and push commits from and to '${upstreamBranch}'.`,
            value: 'pull-push'
        }, {
            label: `Fetch, rebase and push commits from and to '${upstreamBranch}'`,
            warning: `This action will fetch, rebase and push commits from and to '${upstreamBranch}'.`,
            value: 'rebase-push'
        }, {
            label: `Force push commits to '${upstreamBranch}'`,
            warning: `This action will override commits in '${upstreamBranch}'.`,
            value: 'force-push'
        }];
        const method = await this.pick(`Pick how changes should be synchronized:`, methods);
        if (method && await this.confirm('Synchronize Changes', methods.find(({ value }) => value === method)!.warning)) {
            return method;
        }
        return undefined;
    }

    canPublish(): boolean {
        if (this.isSyncing()) {
            return false;
        }
        const status = this.repositoryTracker.selectedRepositoryStatus;
        return !!status && !!status.branch && !status.upstreamBranch;
    }
    async publish(): Promise<void> {
        const repository = this.repositoryTracker.selectedRepository;
        const status = this.repositoryTracker.selectedRepositoryStatus;
        const localBranch = status && status.branch;
        if (!this.canPublish() || !repository || !localBranch) {
            return;
        }
        const remote = await this.getRemote(repository, localBranch);
        if (remote &&
            await this.confirm('Publish changes', `This action will push commits to '${remote}/${localBranch}' and track it as an upstream branch.`)
        ) {
            try {
                await this.git.push(repository, {
                    remote, localBranch, setUpstream: true
                });
            } catch (e) {
                this.error(e);
            }
        }
    }
    protected async getRemote(repository: Repository, branch: string): Promise<string | undefined> {
        const remotes = await this.git.remote(repository);
        if (remotes.length === 0) {
            this.messageService.warn('Your repository has no remotes configured to publish to.');
        }
        return this.pick(`Pick a remote to publish the branch ${branch} to:`, remotes);
    }

    protected shouldPush(status: WorkingDirectoryStatus): boolean {
        return status.aheadBehind ? status.aheadBehind.ahead > 0 : true;
    }
    protected shouldPull(status: WorkingDirectoryStatus): boolean {
        return status.aheadBehind ? status.aheadBehind.behind > 0 : true;
    }

    protected pick(placeholder: string, elements: string[]): Promise<string | undefined>;
    protected pick<T>(placeholder: string, elements: { label: string, value: T }[]): Promise<T | undefined>;
    protected async pick(placeholder: string, elements: (string | { label: string, value: Object })[]): Promise<Object | undefined> {
        if (elements.length === 0) {
            return undefined;
        }
        if (elements.length === 1) {
            return elements[0];
        }
        return new Promise<Object | undefined>(resolve => {
            const items = elements.map(element => {
                const label = typeof element === 'string' ? element : element.label;
                const value = typeof element === 'string' ? element : element.value;
                return new QuickOpenItem({
                    label,
                    run: mode => {
                        if (mode !== QuickOpenMode.OPEN) {
                            return false;
                        }
                        resolve(value);
                        return true;
                    }
                });
            });
            this.quickOpenService.open({
                onType: (lookFor, acceptor) => acceptor(items)
            }, { placeholder, onClose: () => resolve(undefined) });
        });
    }

    protected confirm(title: string, msg: string): Promise<boolean> {
        return new ConfirmDialog({ title, msg, }).open();
    }

    // tslint:disable-next-line:no-any
    protected error(e: any): void {
        if ('message' in e) {
            const message = e['message'];
            if (typeof message === "string" && message.startsWith('GitError')) {
                this.messageService.error(message);
                return;
            }
        }
        throw e;
    }

}
export namespace GitSyncService {
    export type SyncMethod = 'pull-push' | 'rebase-push' | 'force-push';
}
