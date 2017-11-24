/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import { ResourceProvider, Resource, ILogger } from "@theia/core/lib/common";
// import URI from '@theia/core/lib/common/uri';
import { DisposableCollection } from '@theia/core/lib/common';
import { PreferenceProvider, PreferenceProviderPriority, PreferenceProviderClient } from '@theia/preferences-api/lib/browser';
import * as jsoncparser from "jsonc-parser";
import { ParseError } from "jsonc-parser";

export const PreferencePriority = Symbol("PreferencePriority");
export type PreferencePriority = PreferenceProviderPriority;

@injectable()
export class PreferenceProviderUser implements PreferenceProvider {
    protected preferencesCache: { [key: string]: any } = {};

    protected client: PreferenceProviderClient | undefined;

    protected readonly toDispose = new DisposableCollection();

    protected resolveReady: () => void;

    readonly ready = new Promise<void>(resolve => {
        this.resolveReady = resolve;
    });

    protected preferenceResource: Promise<Resource>;

    constructor(
        @inject(ResourceProvider) protected readonly provider: ResourceProvider,
        @inject(ILogger) protected readonly logger: ILogger,
        @inject(PreferencePriority) public readonly priority: PreferenceProviderPriority
    ) {
        // this.preferenceResource = provider(new URI('user_storage:settings.json'));
        this.preferenceResource.then(resource => {
            if (resource.onDidChangeContents) {
                resource.onDidChangeContents(content => this.onDidChangePreferences().then(() =>
                    this.resolveReady()
                ));
            }

            this.toDispose.push(resource);
        });
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    protected async onDidChangePreferences(): Promise<void> {
        const resource = await this.preferenceResource;
        const newContent = await resource.readContents();
        const strippedContent = jsoncparser.stripComments(newContent);
        const errors: ParseError[] = [];
        const preferences = jsoncparser.parse(strippedContent, errors);
        if (errors.length) {
            for (const error of errors) {
                this.logger.error("JSON parsing error", error);
            }
        }

        if (this.client) {
            /* Tell the service to recalculate the preferences with scopes */
            this.client.onNewPreferences({});
        }

        this.preferencesCache = preferences;
    }

    has(preferenceName: string): boolean {
        return this.preferencesCache[preferenceName] !== undefined;
    }

    getPreferences(): { [key: string]: any } {
        return this.preferencesCache;
    }

    setClient(client: PreferenceProviderClient) {
        this.client = client;
    }
}
