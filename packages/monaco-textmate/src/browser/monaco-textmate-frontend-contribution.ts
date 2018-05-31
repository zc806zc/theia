/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { MonacoTextmateService } from './monaco-textmate-service';
import { loadWASM } from 'onigasm';

// import { LanguageGrammarDefinitionContribution } from './textmate-contribution';

@injectable()
export class MonacoTextmateFrontendApplicationContribution implements FrontendApplicationContribution {

    @inject(MonacoTextmateService) protected readonly tmService: MonacoTextmateService;

    async onStart() {
        await loadWASM(require('onigasm/lib/onigasm.wasm'));
        this.tmService.init();

        // const theme = require('../../src/browser/dark_plus.json');
        const theme = require('../../src/browser/monokai-color-theme.json');
        const rules: any[] = [];

        console.log('IUAWHDAIOUWHDOAHWOIDOAIJWDOPAIPWODKPAOF');

        for (const tokenColor of theme.tokenColors) {

            if (typeof tokenColor.scope === void 0) {
                console.log('AAAAAAAAAAAAAAA');
                tokenColor.scope = [''];
            } else if (typeof tokenColor.scope === 'string') {
                console.log('BBBBBBBBBBBBBBB');
                tokenColor.scope = tokenColor.scope.split(', ');
            }

            console.log(`TokenColor: ${JSON.stringify(tokenColor)}`);

            for (const scope of tokenColor.scope) {
                console.log(`   Scope: ${scope}`);

                const settings = Object.keys(tokenColor.settings).reduce((previous: any, current) => {
                    let value: string = tokenColor.settings[current];
                    if (typeof value === typeof '') {
                        value = value.replace(/^\#/, '');
                    }
                    previous[current] = value;
                    return previous;
                }, {});

                rules.push({
                    token: scope, ...settings
                });
            }
        }

        console.log('MEEEEEEEEEEEEEEEEEEEEEEEEEH');
        console.log(rules);

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
