/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable, postConstruct } from 'inversify';
import * as jsoncparser from "jsonc-parser";
import URI from '@theia/core/lib/common/uri';
import { ILogger, Resource, ResourceProvider, MaybePromise } from "@theia/core/lib/common";
import { PreferenceProvider } from '@theia/core/lib/browser/preferences';

@injectable()
export abstract class AbstractResourcePreferenceProvider extends PreferenceProvider {

    protected preferences: { [key: string]: any } = {};

    @inject(ILogger) protected readonly logger: ILogger;

    @inject(ResourceProvider) protected readonly resourceProvider: ResourceProvider;

    protected resource: Promise<Resource>;

    @postConstruct()
    protected async init(): Promise<void> {
        const uri = await this.getUri();
        this.resource = this.resourceProvider(uri);

        // Try to read the initial content of the preferences.  The provider
        // becomes ready even if we fail reading the preferences, so we don't
        // hang the preference service.
        this.readPreferences()
            .then(() => this._ready.resolve())
            .catch(() => this._ready.resolve());

        const resource = await this.resource;
        this.toDispose.push(resource);
        if (resource.onDidChangeContents) {
            this.toDispose.push(resource.onDidChangeContents(content => this.readPreferences()));
        }
    }

    abstract getUri(): MaybePromise<URI>;

    getPreferences(): { [key: string]: any } {
        return this.preferences;
    }

    async setPreference(key: string, value: any): Promise<void> {
        const resource = await this.resource;
        if (resource.saveContents) {
            const content = await resource.readContents();
            const formattingOptions = { tabSize: 3, insertSpaces: true, eol: '' };
            const edits = jsoncparser.modify(content, [key], value, { formattingOptions });
            const result = jsoncparser.applyEdits(content, edits);

            await resource.saveContents(result);
            this.onDidPreferencesChangedEmitter.fire(undefined);
        }
    }

    protected async readPreferences(): Promise<void> {
        const newContent = await this.readContents();
        const strippedContent = jsoncparser.stripComments(newContent);
        this.preferences = jsoncparser.parse(strippedContent);
        this.onDidPreferencesChangedEmitter.fire(undefined);
    }

    protected async readContents(): Promise<string> {
        try {
            const resource = await this.resource;
            return await resource.readContents();
        } catch {
            return '';
        }
    }

}
