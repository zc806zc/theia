/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

// tslint:disable:no-any

import { Disposable } from "./disposable";

/**
 * Represents a typed event.
 */
export interface Event<T> {

    /**
     *
     * @param listener The listener function will be call when the event happens.
     * @param thisArgs The 'this' which will be used when calling the event listener.
     * @param disposables An array to which a {{IDisposable}} will be added.
     * @return a disposable to remove the listener again.
     */
    (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
    /**
     * An emitter will print a warning if more listeners are added for this event.
     * The event.maxListeners allows the limit to be modified for this specific event.
     * The value can be set to 0 to indicate an unlimited number of listener.
     */
    maxListeners: number
}

export namespace Event {
    const _disposable = { dispose() { } };
    export const None: Event<any> = Object.assign(function () { return _disposable; }, {
        get maxListeners(): number { return 0; },
        set maxListeners(maxListeners: number) { }
    });
}

class CallbackList {

    private _callbacks: Function[] | undefined;
    private _contexts: any[] | undefined;

    get length(): number {
        return this._callbacks && this._callbacks.length || 0;
    }

    public add(callback: Function, context: any = null, bucket?: Disposable[]): void {
        if (!this._callbacks) {
            this._callbacks = [];
            this._contexts = [];
        }
        this._callbacks.push(callback);
        this._contexts!.push(context);

        if (Array.isArray(bucket)) {
            bucket.push({ dispose: () => this.remove(callback, context) });
        }
    }

    public remove(callback: Function, context: any = null): void {
        if (!this._callbacks) {
            return;
        }

        let foundCallbackWithDifferentContext = false;
        for (let i = 0, len = this._callbacks.length; i < len; i++) {
            if (this._callbacks[i] === callback) {
                if (this._contexts![i] === context) {
                    // callback & context match => remove it
                    this._callbacks.splice(i, 1);
                    this._contexts!.splice(i, 1);
                    return;
                } else {
                    foundCallbackWithDifferentContext = true;
                }
            }
        }

        if (foundCallbackWithDifferentContext) {
            throw new Error('When adding a listener with a context, you should remove it with the same context');
        }
    }

    public invoke(...args: any[]): any[] {
        if (!this._callbacks) {
            return [];
        }

        const ret: any[] = [];
        const callbacks = this._callbacks.slice(0);
        const contexts = this._contexts!.slice(0);

        for (let i = 0, len = callbacks.length; i < len; i++) {
            try {
                ret.push(callbacks[i].apply(contexts[i], args));
            } catch (e) {
                // FIXME: log error
            }
        }
        return ret;
    }

    public isEmpty(): boolean {
        return !this._callbacks || this._callbacks.length === 0;
    }

    public dispose(): void {
        this._callbacks = undefined;
        this._contexts = undefined;
    }
}

export interface EmitterOptions {
    onFirstListenerAdd?: Function;
    onLastListenerRemove?: Function;
}

export class Emitter<T> {

    private static _noop = function () { };

    private _event: Event<T>;
    private _callbacks: CallbackList | undefined;
    private _disposed = false;

    constructor(private _options?: EmitterOptions) {
    }

    /**
     * For the public to allow to subscribe
     * to events from this Emitter
     */
    get event(): Event<T> {
        if (!this._event) {
            this._event = Object.assign((listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]) => {
                if (!this._callbacks) {
                    this._callbacks = new CallbackList();
                }
                if (this._options && this._options.onFirstListenerAdd && this._callbacks.isEmpty()) {
                    this._options.onFirstListenerAdd(this);
                }
                this._callbacks.add(listener, thisArgs);
                this.checkMaxListeners(this._event.maxListeners);

                let result: Disposable;
                result = {
                    dispose: () => {
                        result.dispose = Emitter._noop;
                        if (!this._disposed) {
                            this._callbacks!.remove(listener, thisArgs);
                            result.dispose = Emitter._noop;
                            if (this._options && this._options.onLastListenerRemove && this._callbacks!.isEmpty()) {
                                this._options.onLastListenerRemove(this);
                            }
                        }
                    }
                };
                if (Array.isArray(disposables)) {
                    disposables.push(result);
                }

                return result;
            }, {
                    maxListeners: 30
                }
            );
        }
        return this._event;
    }

    protected checkMaxListeners(maxListeners: number): void {
        if (maxListeners === 0 || !this._callbacks) {
            return;
        }
        const count = this._callbacks.length;
        if (count > maxListeners) {
            console.warn(new Error(`Possible Emitter memory leak detected. ${maxListeners} exit listeners added. Use event.maxListeners to increase limit`));
        }
    }

    /**
     * To be kept private to fire an event to
     * subscribers
     */
    fire(event: T): any {
        if (this._callbacks) {
            this._callbacks.invoke.call(this._callbacks, event);
        }
    }

    dispose() {
        if (this._callbacks) {
            this._callbacks.dispose();
            this._callbacks = undefined;
        }
        this._disposed = true;
    }
}
