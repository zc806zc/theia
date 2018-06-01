/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import { KeyCode, Key } from '@theia/core/lib/browser';
import { BaseWidget } from '@theia/core/lib/browser/widgets/widget';
import { Event, Emitter } from '@theia/core/lib/common/event';
import { SearchBoxDebounce } from './search-box-debounce';

/**
 * Initializer properties for the search box widget.
 */
@injectable()
export class SearchBoxProps {

    /**
     * Debounce delay (in milliseconds) that is used before notifying clients about search data updates.
     */
    readonly delay: number;

    /**
     * If `true`, the `Previous`, `Next`, and `Clone` buttons will be visible. Otherwise, `false`. Defaults to `false`.
     */
    readonly showButtons?: boolean;

}

export namespace SearchBoxProps {

    /**
     * The default search box widget option.
     */
    export const DEFAULT: SearchBoxProps = {
        delay: 50
    };

}

/**
 * The search box widget.
 */
@injectable()
export class SearchBox extends BaseWidget {

    private static SPECIAL_KEYS = [
        Key.ESCAPE,
        Key.BACKSPACE
    ];

    protected readonly nextEmitter = new Emitter<void>();
    protected readonly previousEmitter = new Emitter<void>();
    protected readonly closeEmitter = new Emitter<void>();
    protected readonly textChangeEmitter = new Emitter<string | undefined>();
    protected readonly input: HTMLInputElement;

    constructor(
        @inject(SearchBoxProps) protected readonly props: SearchBoxProps,
        @inject(SearchBoxDebounce) protected readonly debounce: SearchBoxDebounce) {

        super();
        this.toDispose.pushAll([
            this.nextEmitter,
            this.previousEmitter,
            this.closeEmitter,
            this.textChangeEmitter,
            this.debounce,
            this.debounce.onChanged(data => this.fireTextChange(data))
        ]);
        this.hide();
        this.update();
        const { input } = this.createContent();
        this.input = input;
    }

    get onPrevious(): Event<void> {
        return this.previousEmitter.event;
    }

    get onNext(): Event<void> {
        return this.nextEmitter.event;
    }

    get onClose(): Event<void> {
        return this.closeEmitter.event;
    }

    get onTextChange(): Event<string | undefined> {
        return this.textChangeEmitter.event;
    }

    get keyCodePredicate(): KeyCode.Predicate {
        return this.canHandle.bind(this);
    }

    protected firePrevious(): void {
        this.previousEmitter.fire(undefined);
    }

    protected fireNext(): void {
        this.nextEmitter.fire(undefined);
    }

    protected fireClose(): void {
        this.closeEmitter.fire(undefined);
    }

    protected fireTextChange(input: string | undefined): void {
        this.textChangeEmitter.fire(input);
    }

    handle(event: KeyboardEvent): void {
        const keyCode = KeyCode.createKeyCode(event);
        if (this.canHandle(keyCode)) {
            if (Key.equals(Key.ESCAPE, keyCode)) {
                this.hide();
            } else {
                this.show();
                this.handleKey(keyCode);
            }
        }
    }

    protected handleArrowUp() {
        this.firePrevious();
    }

    protected handleArrowDown() {
        this.fireNext();
    }

    onBeforeHide(): void {
        this.debounce.append(undefined);
        this.fireClose();
    }

    protected handleKey(keyCode: KeyCode) {
        const character = Key.equals(Key.BACKSPACE, keyCode) ? '\b' : keyCode.character;
        const data = this.debounce.append(character);
        if (data) {
            this.input.value = data;
            this.update();
        } else {
            this.hide();
        }
    }

    protected canHandle(keyCode: KeyCode | undefined): boolean {
        if (keyCode === undefined) {
            return false;
        }
        const { ctrl, alt, meta } = keyCode;
        if (ctrl || alt || meta) {
            return false;
        }
        if (keyCode.character || (this.isVisible && SearchBox.SPECIAL_KEYS.some(key => Key.equals(key, keyCode)))) {
            return true;
        }
        return false;
    }

    protected createContent(): {
        container: HTMLElement,
        input: HTMLInputElement,
        previous: HTMLElement | undefined,
        next: HTMLElement | undefined,
        close: HTMLElement | undefined
    } {

        this.addClass(SearchBox.Styles.SEARCH_BOX);

        const input = document.createElement('input');
        input.readOnly = true;
        input.onselectstart = () => false;
        input.type = 'text';
        input.classList.add(
            SearchBox.Styles.SEARCH_INPUT,
            SearchBox.Styles.NON_SELECTABLE
        );
        this.node.appendChild(input);

        let previous: HTMLElement | undefined;
        let next: HTMLElement | undefined;
        let close: HTMLElement | undefined;

        if (!!this.props.showButtons) {
            previous = document.createElement('div');
            previous.classList.add(
                SearchBox.Styles.BUTTON,
                SearchBox.Styles.BUTTON_PREVIOUS
            );
            previous.title = 'Previous (Up)';
            this.node.appendChild(previous);
            previous.onclick = () => this.firePrevious.bind(this)();

            next = document.createElement('div');
            next.classList.add(
                SearchBox.Styles.BUTTON,
                SearchBox.Styles.BUTTON_NEXT
            );
            next.title = 'Next (Down)';
            this.node.appendChild(next);
            next.onclick = () => this.fireNext.bind(this)();

            close = document.createElement('div');
            close.classList.add(
                SearchBox.Styles.BUTTON,
                SearchBox.Styles.BUTTON_CLOSE
            );
            close.title = 'Close (Escape)';
            this.node.appendChild(close);
            close.onclick = () => this.hide.bind(this)();
        }

        return {
            container: this.node,
            input,
            previous,
            next,
            close
        };

    }

}

export namespace SearchBox {

    /**
     * CSS classes for the search box widget.
     */
    export namespace Styles {

        export const SEARCH_BOX = 'theia-search-box';
        export const SEARCH_INPUT = 'theia-search-input';
        export const BUTTON = 'theia-search-button';
        export const BUTTON_PREVIOUS = 'theia-search-button-previous';
        export const BUTTON_NEXT = 'theia-search-button-next';
        export const BUTTON_CLOSE = 'theia-search-button-close';
        export const NON_SELECTABLE = 'theia-non-selectable';

    }

}

/**
 * Search box factory.
 */
export const SearchBoxFactory = Symbol('SearchBoxFactory');
export interface SearchBoxFactory {

    /**
     * Creates a new search box with the given initializer properties.
     */
    (props: SearchBoxProps): SearchBox;

}
