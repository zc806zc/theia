/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule } from 'inversify';
import { SyntaxHighlightingService } from './syntax-highlighting-service';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';

// import '../../src/browser/prism/prism.css';
// import '../../src/browser/prism/prism.js';

export default new ContainerModule(bind => {
    bind(SyntaxHighlightingService).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(SyntaxHighlightingService);
});
