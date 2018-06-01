/*
 * Copyright (C) 2018 Red Hat, Inc.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *   Red Hat, Inc. - initial API and implementation
 */

import { injectable, inject } from "inversify";
import { Endpoint } from "@theia/core/lib/browser";
import { DebugAdapterPath, DebugConfiguration } from "../common/debug-model";
import { DebugProtocol } from "vscode-debugprotocol";
import { Disposable } from "vscode-jsonrpc";
import { Deferred } from "@theia/core/lib/common/promise-util";
import { Emitter, Event, DisposableCollection } from "@theia/core";
import { EventEmitter } from "events";
import { OutputChannelManager } from "@theia/output/lib/common/output-channel";

export const DebugSession = Symbol("DebugSession");

export interface DebugSession extends Disposable, NodeJS.EventEmitter {
    sessionId: string;
    configuration: DebugConfiguration;
    isConnected: boolean;

    getServerCapabilities(): DebugProtocol.Capabilities | undefined;
    initialize(): Promise<DebugProtocol.InitializeResponse>;
    configurationDone(): Promise<DebugProtocol.ConfigurationDoneResponse>;
    attach(args: DebugProtocol.AttachRequestArguments): Promise<DebugProtocol.AttachResponse>;
    launch(args: DebugProtocol.LaunchRequestArguments): Promise<DebugProtocol.LaunchResponse>;
    threads(): Promise<DebugProtocol.ThreadsResponse>;
    stacks(threadId: number): Promise<DebugProtocol.StackTraceResponse>;
    pause(threadId: number): Promise<DebugProtocol.PauseResponse>;
    disconnect(): Promise<DebugProtocol.InitializeResponse>;
    scopes(frameId: number): Promise<DebugProtocol.ScopesResponse>;
    variables(variablesReference: number, start?: number, count?: number): Promise<DebugProtocol.VariablesResponse>;
    setVariable(args: DebugProtocol.SetVariableArguments): Promise<DebugProtocol.SetVariableResponse>;
    evaluate(frameId: number, expression: string, context?: string): Promise<DebugProtocol.EvaluateResponse>;
}

/**
 * DebugSession implementation.
 */
export class DebugSessionImpl extends EventEmitter implements DebugSession {
    protected readonly toDispose = new DisposableCollection();
    protected readonly callbacks = new Map<number, (response: DebugProtocol.Response) => void>();

    protected websocket: Promise<WebSocket>;
    protected capabilities: DebugProtocol.Capabilities = {};

    private sequence: number;
    private _isConnected: boolean;

    constructor(
        public readonly sessionId: string,
        public readonly configuration: DebugConfiguration) {

        super();
        this.websocket = this.createWebSocket();
        this.sequence = 1;
    }

    private createWebSocket(): Promise<WebSocket> {
        const path = DebugAdapterPath + "/" + this.sessionId;
        const url = new Endpoint({ path }).getWebSocketUrl().toString();
        const websocket = new WebSocket(url);

        const initialized = new Deferred<WebSocket>();

        websocket.onopen = () => {
            initialized.resolve(websocket);
        };
        websocket.onclose = () => { };
        websocket.onerror = () => {
            initialized.reject(`Failed to establish connection with debug adapter by url: '${url}'`);
        };
        websocket.onmessage = (event: MessageEvent): void => {
            this.handleMessage(event);
        };

        return initialized.promise;
    }

    initialize(): Promise<DebugProtocol.InitializeResponse> {
        return this.proceedRequest("initialize", {
            clientID: "Theia",
            clientName: "Theia",
            adapterID: this.configuration.type,
            locale: "",
            linesStartAt1: true,
            columnsStartAt1: true,
            pathFormat: "path",
            supportsVariableType: false,
            supportsVariablePaging: false,
            supportsRunInTerminalRequest: false
        }).then((response: DebugProtocol.InitializeResponse) => {
            this.capabilities = response.body || {};
            return response;
        });
    }

    attach(args: DebugProtocol.AttachRequestArguments): Promise<DebugProtocol.AttachResponse> {
        return this.proceedRequest("attach", args)
            .then(response => {
                this.emit("connected");
                this._isConnected = true;
                return response;
            });
    }

    launch(args: DebugProtocol.LaunchRequestArguments): Promise<DebugProtocol.LaunchResponse> {
        return this.proceedRequest("launch", args)
            .then(response => {
                this.emit("connected");
                this._isConnected = true;
                return response;
            });
    }

    threads(): Promise<DebugProtocol.ThreadsResponse> {
        return this.proceedRequest("threads");
    }

    pause(threadId: number): Promise<DebugProtocol.PauseResponse> {
        return this.proceedRequest("pause", { threadId });
    }

    stacks(threadId: number): Promise<DebugProtocol.StackTraceResponse> {
        const args: DebugProtocol.StackTraceArguments = {
            threadId,
            startFrame: 0,
            format: {
                parameters: true,
                parameterTypes: true,
                parameterNames: true,
                parameterValues: true,
                line: true,
                module: true,
                includeAll: true
            }
        };

        return this.proceedRequest("stackTrace", args);
    }

    configurationDone(): Promise<DebugProtocol.ConfigurationDoneResponse> {
        return this.proceedRequest("configurationDone");
    }

    getServerCapabilities(): DebugProtocol.Capabilities {
        return this.capabilities;
    }

    disconnect(): Promise<DebugProtocol.DisconnectResponse> {
        return this.proceedRequest("disconnect", { terminateDebuggee: true }).then(response => {
            this._isConnected = false;
            return response;
        });
    }

    scopes(frameId: number): Promise<DebugProtocol.ScopesResponse> {
        return this.proceedRequest("scopes", { frameId });
    }

    variables(variablesReference: number, start?: number, count?: number): Promise<DebugProtocol.VariablesResponse> {
        const args: DebugProtocol.VariablesArguments = {
            variablesReference, start, count,
            format: { hex: false }
        };
        return this.proceedRequest('variables', args);
    }

    setVariable(args: DebugProtocol.SetVariableArguments): Promise<DebugProtocol.SetVariableResponse> {
        return this.proceedRequest('setVariable', args);
    }

    evaluate(frameId: number, expression: string, context?: string): Promise<DebugProtocol.EvaluateResponse> {
        const args: DebugProtocol.EvaluateArguments = {
            frameId, expression, context,
            format: { hex: false }
        };
        return this.proceedRequest('evaluate', args);
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    set isConnected(isConnected: boolean) {
        throw new Error("readonly");
    }

    protected handleMessage(event: MessageEvent) {
        const message: DebugProtocol.ProtocolMessage = JSON.parse(event.data);
        if (message.type === 'response') {
            this.proceedResponse(message as DebugProtocol.Response);
        } else if (message.type === 'event') {
            this.proceedEvent(message as DebugProtocol.Event);
        }
    }

    protected proceedRequest<T extends DebugProtocol.Response>(command: string, args?: {}): Promise<T> {
        const result = new Deferred<T>();

        const request: DebugProtocol.Request = {
            seq: this.sequence++,
            type: "request",
            command: command,
            arguments: args
        };

        this.callbacks.set(request.seq, (response: T) => {
            if (!response.success) {
                result.reject(response);
            } else {
                result.resolve(response);
            }
        });

        return this.websocket
            .then(websocket => websocket.send(JSON.stringify(request)))
            .then(() => result.promise);
    }

    protected proceedResponse(response: DebugProtocol.Response): void {
        console.log(response);

        const callback = this.callbacks.get(response.request_seq);
        if (callback) {
            this.callbacks.delete(response.request_seq);
            callback(response);
        }
    }

    protected proceedEvent(event: DebugProtocol.Event): void {
        console.log(event);
        this.emit(event.event, event);
    }

    dispose() {
        this._isConnected = false;
        this.callbacks.clear();
        this.websocket
            .then(websocket => websocket.close())
            .catch(error => console.error(error));
    }
}

@injectable()
export class DebugSessionFactory {
    get(sessionId: string, debugConfiguration: DebugConfiguration): DebugSession {
        return new DebugSessionImpl(sessionId, debugConfiguration);
    }
}

/** It is intended to manage active debug sessions. */
@injectable()
export class DebugSessionManager {
    private activeDebugSessionId: string | undefined;

    protected readonly sessions = new Map<string, DebugSession>();
    protected readonly onDidCreateDebugSessionEmitter = new Emitter<DebugSession>();
    protected readonly onDidChangeActiveDebugSessionEmitter = new Emitter<DebugSession | undefined>();
    protected readonly onDidDestroyDebugSessionEmitter = new Emitter<DebugSession>();

    constructor(
        @inject(DebugSessionFactory)
        protected readonly debugSessionFactory: DebugSessionFactory,
        @inject(OutputChannelManager)
        protected readonly outputChannelManager: OutputChannelManager
    ) { }

    /**
     * Creates a new [debug session](#DebugSession).
     * @param sessionId The session identifier
     * @param configuration The debug configuration
     * @returns The debug session
     */
    create(sessionId: string, debugConfiguration: DebugConfiguration): DebugSession {
        const session = this.debugSessionFactory.get(sessionId, debugConfiguration);
        this.sessions.set(sessionId, session);
        this.onDidCreateDebugSessionEmitter.fire(session);

        const channel = this.outputChannelManager.getChannel(debugConfiguration.name);
        session.on("output", event => {
            const outputEvent = (event as DebugProtocol.OutputEvent);
            channel.appendLine(outputEvent.body.output);
        });
        session.on("initialized", () => this.setActiveDebugSession(sessionId));
        session.on("terminated", () => this.destroy(sessionId));

        session.initialize()
            .then(response => {
                const request = debugConfiguration.request;
                switch (request) {
                    case "attach": return session.attach(debugConfiguration);
                    default: return Promise.reject(`Unsupported request '${request}' type.`);
                }
            })
            .then(response => session.configurationDone());

        return session;
    }

    /**
     * Removes the [debug session](#DebugSession).
     * @param sessionId The session identifier
     */
    remove(sessionId: string): void {
        this.sessions.delete(sessionId);
        if (this.activeDebugSessionId) {
            if (this.activeDebugSessionId === sessionId) {
                if (this.sessions.size !== 0) {
                    this.setActiveDebugSession(this.sessions.keys().next().value);
                } else {
                    this.setActiveDebugSession(undefined);
                }
            }
        }
    }

    /**
     * Finds a debug session by its identifier.
     * @returns The debug sessions
     */
    find(sessionId: string): DebugSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Finds all instantiated debug sessions.
     * @returns An array of debug sessions
     */
    findAll(): DebugSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Sets the active debug session.
     * @param sessionId The session identifier
     */
    setActiveDebugSession(sessionId: string | undefined) {
        if (this.activeDebugSessionId !== sessionId) {
            this.activeDebugSessionId = sessionId;
            this.onDidChangeActiveDebugSessionEmitter.fire(this.getActiveDebugSession());
        }
    }

    /**
     * Returns the active debug session.
     * @returns the [debug session](#DebugSession)
     */
    getActiveDebugSession(): DebugSession | undefined {
        if (this.activeDebugSessionId) {
            return this.sessions.get(this.activeDebugSessionId);
        }
    }

    /**
     * Destroy the debug session. If session identifier isn't provided then
     * all active debug session will be destroyed.
     * @param sessionId The session identifier
     */
    destroy(sessionId?: string): void {
        if (sessionId) {
            const session = this.sessions.get(sessionId);
            if (session) {
                this.doDestroy(session);
            }
        } else {
            this.sessions.forEach(session => this.doDestroy(session));
        }
    }

    private doDestroy(session: DebugSession): void {
        session.dispose();
        this.remove(session.sessionId);
        this.onDidDestroyDebugSessionEmitter.fire(session);
    }

    get onDidChangeActiveDebugSession(): Event<DebugSession | undefined> {
        return this.onDidChangeActiveDebugSessionEmitter.event;
    }

    get onDidCreateDebugSession(): Event<DebugSession> {
        return this.onDidCreateDebugSessionEmitter.event;
    }

    get onDidDestroyDebugSession(): Event<DebugSession> {
        return this.onDidDestroyDebugSessionEmitter.event;
    }
}
