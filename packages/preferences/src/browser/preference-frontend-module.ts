/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule, } from 'inversify';
import { PreferenceService, PreferenceServiceImpl, PreferenceProvider, PreferenceProviderPriority } from "@theia/preferences-api/lib/browser/";
import { PreferencePriority, PreferenceProviderUser } from './preference-provider-user';
// export const UserPreferenceProvider = Symbol('UserPreferenceProvider');
// export type UserPreferenceProvider = PreferenceProvider;

export default new ContainerModule(bind => {

    bind(PreferencePriority).toConstantValue(PreferenceProviderPriority.USER);
    bind(PreferenceProvider).to(PreferenceProviderUser).inSingletonScope();

    bind(PreferenceService).to(PreferenceServiceImpl).inSingletonScope();
    // bind(PreferenceService).toDynamicValue(ctx => {
    //     const userProvider = ctx.container.get<PreferenceProviderUser>(PreferenceProviderUser);
    //     return new PreferenceServiceImpl(userProvider);
    // }).inSingletonScope();
});
