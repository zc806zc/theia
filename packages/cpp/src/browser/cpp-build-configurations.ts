/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { Command, CommandContribution, CommandRegistry, Event, Emitter } from "@theia/core";
import { injectable, inject, postConstruct } from "inversify";
import { QuickOpenService } from "@theia/core/lib/browser/quick-open/quick-open-service";
import { QuickOpenModel, QuickOpenItem, QuickOpenMode, } from "@theia/core/lib/browser/quick-open/quick-open-model";
import { StorageService } from "@theia/core/lib/browser/storage-service";
import { CppPreferences } from "./cpp-preferences";

export interface CppBuildConfiguration {
    name: string;
    directory: string;
}

/** What we save in the local storage.  */
class SavedActiveBuildConfiguration {
    configName?: string;
}

/**
 * Entry point to get the list of build configurations and get/set the active
 * build configuration.
 */
@injectable()
export class CppBuildConfigurationManager {
    @inject(StorageService)
    protected readonly storageService: StorageService;

    @inject(CppPreferences)
    protected readonly cppPreferences: CppPreferences;

    /**
     * The current active build configuration.  undefined means there's not
     * current active configuration.
     */
    protected activeConfig: CppBuildConfiguration | undefined;

    /** Emitter for when the active build configuration changes.  */
    protected readonly activeConfigChangeEmitter = new Emitter<CppBuildConfiguration | undefined>();

    readonly ACTIVE_BUILD_CONFIGURATION_STORAGE_KEY = 'cpp.active-build-configuration';
    readonly BUILD_CONFIGURATIONS_PREFERENCE_KEY = 'cpp.buildConfigurations';

    /**
     * Promise resolved when the list of build configurations has been read
     * once, and the active configuration has been set, if relevant.
     */
    public ready: Promise<void>;

    @postConstruct()
    async init() {
        // Try to read the active build config from local storage.
        this.ready = new Promise(async resolve => {
            await this.cppPreferences.ready;
            this.loadActiveConfiguration().then(resolve);
        });
    }

    /** Load the active build config from the persistent storage.  */
    protected async loadActiveConfiguration() {
        const savedConfig =
            await this.storageService.getData<SavedActiveBuildConfiguration>(
                this.ACTIVE_BUILD_CONFIGURATION_STORAGE_KEY);

        if (savedConfig !== undefined && savedConfig.configName !== undefined) {
            // Try to find an existing config with that name.
            const configs = this.getConfigs();
            const config = configs.find(cfg => savedConfig.configName === cfg.name);
            if (config) {
                this.setActiveConfig(config);
            }
        }
    }

    /**
     * Save the active build config name to persistent storage.
     */
    protected saveActiveConfiguration(config: CppBuildConfiguration | undefined) {
        this.storageService.setData<SavedActiveBuildConfiguration>(
            this.ACTIVE_BUILD_CONFIGURATION_STORAGE_KEY, {
                configName: config ? config.name : undefined,
            });
    }

    /** Get the active build configuration.  */
    getActiveConfig(): CppBuildConfiguration | undefined {
        return this.activeConfig;
    }

    /** Change the active build configuration.  */
    setActiveConfig(config: CppBuildConfiguration | undefined) {
        this.activeConfig = config;
        this.saveActiveConfiguration(config);
        this.activeConfigChangeEmitter.fire(config);
    }

    /** Event emitted when the active build configuration changes.  */
    get onActiveConfigChange(): Event<CppBuildConfiguration | undefined> {
        return this.activeConfigChangeEmitter.event;
    }

    /** Get the list of defined build configurations.  */
    getConfigs(): CppBuildConfiguration[] {
        return this.cppPreferences[this.BUILD_CONFIGURATIONS_PREFERENCE_KEY] || [];
    }
}

@injectable()
export class CppBuildConfigurationChanger implements QuickOpenModel {

    @inject(QuickOpenService)
    protected readonly quickOpenService: QuickOpenService;

    @inject(CppBuildConfigurationManager)
    protected readonly cppBuildConfigurations: CppBuildConfigurationManager;

    async onType(lookFor: string, acceptor: (items: QuickOpenItem[]) => void): Promise<void> {
        const items: QuickOpenItem[] = [];
        const active: CppBuildConfiguration | undefined = this.cppBuildConfigurations.getActiveConfig();

        // Add one item per build config.
        this.cppBuildConfigurations.getConfigs().forEach(config => {
            items.push(new QuickOpenItem({
                label: config.name,
                description: config === active ? 'active' : '',
                run: (mode: QuickOpenMode): boolean => {
                    if (mode !== QuickOpenMode.OPEN) {
                        return false;
                    }

                    this.cppBuildConfigurations.setActiveConfig(config);
                    return true;
                },
            }));
        });

        acceptor(items);
    }

    open() {
        this.quickOpenService.open(this, {
            placeholder: 'Choose a build configuration...',
        });
    }
}

/**
 * Open the quick open menu to let the user change the active build
 * configuration.
 */
export const CPP_CHANGE_BUILD_CONFIGURATION: Command = {
    id: 'cpp.change-build-configuration',
    label: 'C/C++: Change Build Configuration'
};

@injectable()
export class CppBuildConfigurationsContributions implements CommandContribution {

    @inject(CppBuildConfigurationChanger)
    protected readonly cppChangeBuildConfiguration: CppBuildConfigurationChanger;

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(CPP_CHANGE_BUILD_CONFIGURATION, {
            execute: () => this.cppChangeBuildConfiguration.open()
        });
    }
}
