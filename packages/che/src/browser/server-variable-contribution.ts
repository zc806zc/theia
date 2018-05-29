/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import { VariableContribution, VariableRegistry } from '@theia/variable-resolver/lib/browser';
import { Workspace } from './che-workspace-client';

@injectable()
export class ServerVariableContribution implements VariableContribution {

    @inject(Workspace)
    protected readonly workspaceService: Workspace;

    async registerVariables(variables: VariableRegistry): Promise<void> {
        const machines = await this.workspaceService.getListMachines();
        // tslint:disable-next-line:forin
        for (const machineName in machines) {
            const servers = machines[machineName].servers;
            // tslint:disable-next-line:forin
            for (const serverName in servers) {
                const url = servers[serverName].url;
                if (url) {
                    variables.registerVariable({
                        name: `server.${serverName}`,
                        description: url,
                        resolve: () => url
                    });
                }
            }
        }
    }
}
