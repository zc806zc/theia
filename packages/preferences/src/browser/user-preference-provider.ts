/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { AbstractResourcePreferenceProvider } from './abstract-resource-preference-provider';

@injectable()
export class UserPreferenceProvider extends AbstractResourcePreferenceProvider {

    getUri() {
        return new URI().withScheme('user_storage').withPath('settings.json');
    }

}
