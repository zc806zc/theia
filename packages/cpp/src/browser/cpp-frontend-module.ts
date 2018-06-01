/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from "inversify";
import { CommandContribution } from '@theia/core/lib/common';
import { KeybindingContribution, KeybindingContext } from '@theia/core/lib/browser';
import { CppCommandContribution } from './cpp-commands';

import { LanguageClientContribution } from "@theia/languages/lib/browser";
import { CppLanguageClientContribution } from "./cpp-language-client-contribution";
import { CppKeybindingContribution, CppKeybindingContext } from "./cpp-keybinding";
import { bindCppPreferences } from "./cpp-preferences";
import { CppBuildConfigurationsContributions, CppBuildConfigurationChanger, CppBuildConfigurationManager } from "./cpp-build-configurations";

export default new ContainerModule(bind => {
    bind(CommandContribution).to(CppCommandContribution).inSingletonScope();
    bind(CppKeybindingContext).toSelf().inSingletonScope();
    bind(KeybindingContext).toDynamicValue(context => context.container.get(CppKeybindingContext));
    bind(KeybindingContribution).to(CppKeybindingContribution).inSingletonScope();

    bind(CppLanguageClientContribution).toSelf().inSingletonScope();
    bind(LanguageClientContribution).toDynamicValue(ctx => ctx.container.get(CppLanguageClientContribution));

    bind(CppBuildConfigurationManager).toSelf().inSingletonScope();
    bind(CppBuildConfigurationChanger).toSelf().inSingletonScope();
    bind(CppBuildConfigurationsContributions).toSelf().inSingletonScope();
    bind(CommandContribution).to(CppBuildConfigurationsContributions).inSingletonScope();

    bindCppPreferences(bind);
});
