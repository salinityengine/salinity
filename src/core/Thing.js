import { MathUtils } from '../utils/MathUtils.js';
import { VERSION } from '../constants.js';

class Thing {

    constructor(name = 'Thing') {
        // Prototype
        this.isThing = true;
        this.type = 'Thing';

        // Properties
        this.name = name;
        this.uuid = MathUtils.randomUUID();
    }

    /******************** COPY / CLONE */

    clone(recursive = false) {
        return new this.constructor().copy(this, recursive);
    }

    copy(source, recursive = true) {
        // Clear Existing Properites
        this.dispose();

        // Copy Properties
        this.name = source.name;
        /* DON'T COPY UUID: this.uuid = source.uuid; */
        return this;
    }

    /******************** JSON */

    toJSON() {
        const data = {};
        data.meta = {
            type: this.type,
            version: VERSION,
        };
        data.name = this.name;
        data.uuid = this.uuid;
        return data;
    }

    fromJSON(data) {
        if (data.name !== undefined) this.name = data.name;
        if (data.uuid !== undefined) this.uuid = data.uuid;
        return this;
    }

}

export { Thing };