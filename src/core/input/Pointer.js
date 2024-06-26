import {
    MOUSE_DOUBLE_TIME,
} from '../../constants.js';
import { Key } from './Key.js';
import { Vector2 } from '../../math/Vector2.js';

class Pointer {

    // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
    static LEFT = 0;
    static MIDDLE = 1;
    static RIGHT = 2;
    static BACK = 3;
    static FORWARD = 4;

    #locked = false; // 0
    #lockID = 1;

    constructor(element, disableContextMenu = true) {
        if (!element || !element.dom) {
            console.error(`Pointer: No element was provided`);
            return;
        }
        const self = this;

        // Raw data
        this._keys = new Array(5);
        this._location = new Vector2(0, 0);
        this._locationUpdated = false;
        this._delta = new Vector2(0, 0);
        this._wheel = 0;
        this._wheelUpdated = false;
        this._doubleClicked = new Array(5);
        this._clickTime = new Array(5);

        this.keys = new Array(5);               // pointer buttons states
        this.position = new Vector2(0, 0);      // position inside of the window (coordinates in world space)
        this.location = new Vector2(0, 0);      // location inside of the window (coordinates in window space)
        this.delta = new Vector2(0, 0);         // movement since the last update (coordinates in window space)
        this.wheel = 0;                         // scroll wheel movement since the last update
        this.doubleClicked = new Array(5);      // indicates a button of the pointer was double clicked
        this.downAt = new Vector2(0, 0);        // stores pointer down location
        this.pointerInside = false;             // indicated if pointer is inside DOM element
        this.dragging = false;                  // indicates if pointer is dragging an object

        // Initialize key instances
        for (let i = 0; i < 5; i++) {
            this._doubleClicked[i] = false;
            this.doubleClicked[i] = false;
            this._keys[i] = new Key();
            this.keys[i] = new Key();
        }

        // Updates
        function updateLocation(x, y) {
            if (element && element.dom) {
                const rect = element.dom.getBoundingClientRect();
                x -= rect.left;
                y -= rect.top;
            }
            const xDiff = x - self._location.x;
            const yDiff = y - self._location.y;
            self._delta.x += xDiff;
            self._delta.y += yDiff;
            self._location.set(x, y);
            self._locationUpdated = true;
            self.position.set(x, -y);
        }
        function updateKey(button, action) {
            if (button >= 0) self._keys[button].update(action);
        }

        // Disable Context Menu
        if (disableContextMenu) {
            element.on('contextmenu', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
        }

        // Pointer
        element.on('pointermove', (event) => {
            updateLocation(event.clientX, event.clientY);
        });
        element.on('pointerdown', (event) => {
            element.dom.setPointerCapture(event.pointerId);
            updateKey(event.button, Key.DOWN);
            self._clickTime[event.button] = performance.now();
        });
        element.on('pointerup', (event) => {
            element.dom.releasePointerCapture(event.pointerId);
            updateKey(event.button, Key.UP);
        });
        element.on('pointerenter', () => { self.pointerInside = true; });
        element.on('pointerleave', () => { self.pointerInside = false; });

        // Wheel
        element.on('wheel', (event) => {
            self._wheel = event.deltaY;
            self._wheelUpdated = true;
        });

        // Drag
        element.on('dragstart', (event) => { updateKey(event.button, Key.UP); });

        // Double Click
        element.on('dblclick', (event) => {
            self._doubleClicked[event.button] = (performance.now() - self._clickTime[event.button]) < MOUSE_DOUBLE_TIME;
        });
    }

    buttonPressed(button, id = -1) {
        if (this.#locked && this.#locked !== id) return false;
        return this.keys[button].pressed;
    }

    buttonDoubleClicked(button, id = -1) {
        if (this.#locked && this.#locked !== id) return false;
        return this.doubleClicked[button];
    }

    buttonJustPressed(button, id = -1) {
        if (this.#locked && this.#locked !== id) return false;
        return this.keys[button].justPressed;
    }

    buttonJustReleased(button, id = -1) {
        if (this.#locked && this.#locked !== id) return false;
        return this.keys[button].justReleased;
    }

    insideDom() {
        return this.pointerInside;
    }

    lock() {
        this.#locked = this.#lockID;
        this.#lockID++;
        return this.#locked;
    }

    unlock() {
        this.#locked = false;
    }

    update() {
        // Key States
        for (let i = 0; i < 5; i++) {
            // Pressed
            if (this._keys[i].justPressed && this.keys[i].justPressed) this._keys[i].justPressed = false;
            if (this._keys[i].justReleased && this.keys[i].justReleased) this._keys[i].justReleased = false;
            this.keys[i].set(this._keys[i].justPressed, this._keys[i].pressed, this._keys[i].justReleased);

            // Double Click
            if (this._doubleClicked[i] === true) {
                this.doubleClicked[i] = true;
                this._doubleClicked[i] = false;
            } else {
                this.doubleClicked[i] = false;
            }
        }

        // Wheel
        if (this._wheelUpdated) {
            this.wheel = this._wheel;
            this._wheelUpdated = false;
        } else {
            this.wheel = 0;
        }

        // Pointer Location
        if (this._locationUpdated) {
            this.delta.copy(this._delta);
            this.location.copy(this._location);
            this._delta.set(0, 0);
            this._locationUpdated = false;
        } else {
            this.delta.x = 0;
            this.delta.y = 0;
        }
    }

}

export { Pointer };
