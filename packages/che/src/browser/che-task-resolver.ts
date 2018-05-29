/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import { TaskResolver } from '@theia/task/lib/common';
import { VariableResolverService } from '@theia/variable-resolver/lib/browser';
import { CheTaskConfiguration, Target } from '../common/task-protocol';

/**
 * Prepares a Che Task for execution:
 * - resolve the variables in a command line;
 * - add the current Che workspace's ID if none;
 * - allows to choose a target machine if none.
 */
@injectable()
export class CheTaskResolver implements TaskResolver {

    @inject(VariableResolverService)
    protected readonly variableResolverService: VariableResolverService;

    async resolveTask(task: CheTaskConfiguration): Promise<CheTaskConfiguration> {
        const resultTarget: Target = {};

        if (!task.target) {
            resultTarget.workspaceId = await this.getWsId();
            resultTarget.machineName = await this.pickMachine();
        } else {
            resultTarget.workspaceId = task.target.workspaceId ? task.target.workspaceId : await this.getWsId();
            resultTarget.machineName = task.target.machineName ? task.target.machineName : await this.pickMachine();
        }

        const resultTask: CheTaskConfiguration = {
            type: task.type,
            label: task.label,
            command: await this.variableResolverService.resolve(task.command),
            target: resultTarget
        };
        return resultTask;
    }

    protected async getWsId(): Promise<string> {
        return 'workspace65834j0w3dkdqy1i';
    }

    protected async pickMachine(): Promise<string> {
        // this.wsClient.getListMachines();
        return 'theia';
    }
}
