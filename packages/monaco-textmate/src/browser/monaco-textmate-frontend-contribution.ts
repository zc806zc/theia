/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { MonacoTextmateService } from './monaco-textmate-service';
// import URI from '@theia/core/lib/common/uri';
import { loadWASM } from 'onigasm';

// import { LanguageGrammarDefinitionContribution } from './textmate-contribution';

@injectable()
export class MonacoTextmateFrontendApplicationContribution implements FrontendApplicationContribution {

    @inject(MonacoTextmateService)
    protected readonly tmService: MonacoTextmateService;

    protected readonly themeFolder = (require as any).context('../../src/browser/themes');

    protected getTheme(name: string): any {
        return require(this.themeFolder.resolve(`./${name}.json`).toString());
    }

    protected parseThemeIntoRules(rules: any[], theme: any) {

        if (typeof theme.inherit !== 'undefined') {
            const subTheme = this.getTheme(theme.inherit);
            this.parseThemeIntoRules(rules, subTheme);
        }

        for (const tokenColor of theme.tokenColors) {

            if (typeof tokenColor.scope === 'undefined') {
                tokenColor.scope = [''];
            } else if (typeof tokenColor.scope === 'string') {
                tokenColor.scope = (tokenColor.scope as string).split(',').map(scope => scope.trim());
            }

            // console.log(`TokenColor: ${JSON.stringify(tokenColor)}`);
            for (const scope of tokenColor.scope) {
                // console.log(`   Scope: ${scope}`);

                const settings = Object.keys(tokenColor.settings).reduce((previous: any, current) => {
                    let value: string = tokenColor.settings[current];
                    if (typeof value === typeof '') {
                        value = value.replace(/^\#/, '').slice(0, 6);
                    }
                    previous[current] = value;
                    return previous;
                }, {});

                rules.push({
                    token: scope, ...settings
                });
            }
        }
    }

    async onStart() {
        await loadWASM(require('onigasm/lib/onigasm.wasm'));
        this.tmService.init();

        const activeTheme = [
            'monokai-color-theme',
            'dark_plus',
        ][1];

        const theme = this.getTheme(activeTheme);
        const rules: any[] = [];

        monaco.editor.defineTheme('mehmehmeh', {
            base: 'vs-dark',
            inherit: true,
            colors: theme.colors,
            rules,
        });

        monaco.editor.setTheme('mehmehmeh');
    }

    onStop() {
    }

}
