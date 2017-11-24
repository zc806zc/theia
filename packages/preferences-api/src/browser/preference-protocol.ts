/*
 * Copyright (C) 2017 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { Event, Disposable } from '@theia/core/lib/common';

export interface PreferenceChangedEvent {
    changes: PreferenceChange[]
}

export interface PreferenceChange {
    readonly preferenceName: string;
    readonly newValue?: any;
    readonly oldValue?: any;
}

export const PreferenceService = Symbol('PreferenceService');
export interface PreferenceService extends Disposable {

    get<T>(preferenceName: string): T | undefined;
    get<T>(preferenceName: string, defaultValue: T): T;
    get<T>(preferenceName: string, defaultValue?: T): T | undefined;
    ready: Promise<void>;

    onPreferenceChanged: Event<PreferenceChange>;
}

export interface NewPreferencesEvent {

}
export const PreferenceProvider = Symbol('PreferenceProvider');

export interface PreferenceProvider extends Disposable {
    getPreferences(): { [key: string]: any };
    setClient(client: PreferenceProviderClient | undefined): void;
    priority: PreferenceProviderPriority;
    ready: Promise<void>;
}

export enum PreferenceProviderPriority {
    USER = 1,
    WORKSPACE = 2,
}

export interface PreferenceProviderClient {
    onNewPreferences(event: NewPreferencesEvent): void
}
