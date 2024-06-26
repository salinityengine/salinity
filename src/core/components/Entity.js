import { ComponentManager } from '../ComponentManager.js';
import { Object2D } from '../Object2D.js';
import { Thing } from '../Thing.js';

class Entity extends Object2D {

    constructor(name = 'Entity') {
        super(name);

        // Prototype
        this.isEntity = true;
        this.type = 'Entity';

        // Properties
        this.category = null;                   // used for organizing Prefabs
        this.locked = false;                    // locked in Editor? (do not allow selection, deletion, duplication, etc.)
        this.visible = true;                    // should be rendered?

        // Structure
        this.components = [];                   // geometry, material, audio, light, etc.
        this.children = [];
        this.parent = null;

        // Internal
        this.loadedDistance = 0;                // for tracking removal during App.play()
    }

    /** Component types this Entity is allowed to have */
    componentFamily() {
        return [ 'Entity' ];
    }

    /******************** COMPONENTS */

    /** Adds component of 'type' using 'data' object */
    addComponent(type, data = {}, includeDependencies = true) {
        const ComponentClass = ComponentManager.registered(type);
        if (ComponentClass === undefined) return undefined;

        // Config
        const config = ComponentClass.config;

        // Create new component if 'multiple' allowed (or if doesn't already have component)
        let component = this.getComponent(type);
        if (!component || ComponentClass.config.multiple) {
            component = new ComponentClass();
            this.components.push(component);
        }

        // Check for and add Dependent Components
        if (config.dependencies && includeDependencies) {
            for (const dependency of config.dependencies) {
                if (this.getComponent(dependency) == undefined) {
                    this.addComponent(dependency, {}, false /* includeDependencies */);
                }
            }
        }

        // Sanitize Data
        ComponentManager.sanitizeData(type, data);

        // Initialize Component
        component.detach();
        component.entity = this;
        component.init(data);
        component.attach();

        // Return reference to newly added component
        return component;
    }

    /** Adds an existing component (WARNING: Does not check for 'multiple' flag) */
    attachComponent(component) {
        this.components.push(component);
        component.detach();
        component.entity = this;
        component.init(component.toJSON());
        component.attach();
        return component;
    }

    /** Updates component with entirely new data (keeping any existing data) */
    updateComponent(type, data = {}, index = 0) {
        const component = this.getComponentsWithProperties('type', type)[index];
        if (!component || !component.isComponent) return;
        const newData = component.data ?? {};
        Object.assign(newData, data);
        ComponentManager.sanitizeData(type, newData);
        this.detach();
        this.init(newData);
        this.attach();
        return component;
    }

    /** Updates component with entirely new data */
    replaceComponent(type, data = {}, index = 0) {
        const component = this.getComponentsWithProperties('type', type)[index];
        if (!component || !component.isComponent) return;
        ComponentManager.sanitizeData(type, data);
        component.detach();
        component.init(data);
        component.attach();
        return component;
    }

    /** Get component by type (string, required) and id (string, optional - in case of multiple components with type) */
    getComponent(type, id /* optional */) {
        if (id === undefined) return this.getComponentByProperty('type', type);
        const components = this.getComponentsWithProperties('type', type, 'id', id);
        if (components.length > 0) return components[0];
        return undefined;
    }

    getComponentByID(id) {
        return this.getComponentByProperty('id', id);
    }

    getComponentByType(type) {
        return this.getComponentByProperty('type', type);
    }

    getComponentsByType(type) {
        return this.getComponentsWithProperties('type', type);
    }

    /** Returns first component found with property === value */
    getComponentByProperty(property, value) {
        for (const component of this.components) {
            if (component[property] === value) return component;
        }
        return undefined;
    }

    /** Returns all components that match all key, value pairs */
    getComponentsWithProperties(/* key, value, key, value, etc. */) {
        const components = [];
        for (const component of this.components) {
            let hasProperties = true;
            for (let i = 0; i < arguments.length; i += 2) {
                const key = arguments[i];
                const value = arguments[i + 1];
                if (component[key] !== value) {
                    hasProperties = false;
                    break;
                }
            }
            if (hasProperties) components.push(component);
        }
        return components;
    }

    /** NOTE: Does not call dispose on component! */
    removeComponent(component) {
        if (!component) return;
        const index = this.components.indexOf(component);
        if (index !== -1) {
            this.components.splice(index, 1);
            component.detach();
            return component;
        }
        console.warn(`Entity.removeComponent(): Component ${component.uuid}, type '${component.type}' not found`);
    }

    rebuildComponents() {
        for (const component of this.components) {
            component.detach();
            component.init(component.toJSON());
            component.attach();
        }
        return this;
    }

    /** Return 'true' in callback to stop further recursion */
    traverseComponents(callback) {
        for (const component of this.components) {
            if (typeof callback === 'function' && callback(component)) return;
        }
    }

    /******************** CHILDREN */

    addEntity(...entities) {
        for (const entity of entities) {
            if (!entity || !entity.isEntity) continue;
            if (this.children.indexOf(entity) !== -1) continue;
            if (entity === this) continue;
            entity.removeFromParent();
            entity.parent = this;
            this.children.push(entity);
        }
        return this;
    }

    getEntities() {
        const entities = [];
        for (const entity of this.children) {
            if (!entity || !entity.isEntity) continue;
            // if (entity.userData.flagIgnore) continue;
            // if (entity.userData.flagHelper) continue;
            entities.push(entity);
        }
        return entities;
    }

    getEntityById(id) {
        return this.getEntityByProperty('id', parseInt(id));
    }

    getEntityByName(name) {
        return this.getEntityByProperty('name', name);
    }

    getEntityByUUID(uuid) {
        return this.getEntityByProperty('uuid', uuid);
    }

    /** Recursively searches for a child Entity */
    getEntityByProperty(property, value) {
        if (this[property] === value) return this;
        for (const child of this.getEntities()) {
            const entity = child.getEntityByProperty(property, value);
            if (entity) return entity;
        }
        return undefined;
    }

    /** Removes entity, does not call 'dispose()' on Entity! */
    removeEntity(entity, forceDelete = false) {
        if (!entity) return;
        if (!forceDelete && entity.locked) return;
        const index = this.children.indexOf(entity);
        if (index !== -1) {
            entity.parent = null;
            this.children.splice(index, 1);
            /* entity is now out of Project */
        }
        return entity;
    }

    /** Traverse an entity and it's children, recursively. Return 'true 'in callback to stop traversing. */
    traverse(callback, recursive = true) {
        if (typeof callback === 'function' && callback(this)) return true;
        for (const child of this.children) {
            if (child.traverse(callback, recursive)) return true;
        }
    }

    /** Return 'true' in callback to stop further recursion */
    traverseEntities(callback, recursive = true) {
        if (typeof callback === 'function' && callback(this)) return true;
        for (const child of this.getEntities()) {
            if (child.traverseEntities(callback, recursive)) return true;
        }
    }

    /******************** PARENT */

    changeParent(newParent = undefined, newIndex = -1) {
        if (!newParent) newParent = this.parent;
        if (!newParent || !newParent.isEntity) return;

        // Check if we have a parent
        const oldParent = this.parent;
        if (newIndex === -1 && oldParent) newIndex = oldParent.children.indexOf(this);

        // Move
        newParent.addEntity(this);

        // If desired array index was supplied, move entity to that index
        if (newIndex !== -1) {
            newParent.children.splice(newIndex, 0, this);
            newParent.children.pop();
        }
        return this;
    }

    /** Returns top level entity that is not a world or stage */
    parentEntity() {
        let entity = this;
        while (entity && entity.parent) {
            if (entity.parent.isStage) return entity;
            if (entity.parent.isWorld) return entity;
            entity = entity.parent;
        }
        return entity;
    }

    /** Returns parent stage (fallback to world) of an entity */
    parentStage() {
        if (this.isStage || this.isWorld) return this;
        if (this.parent && this.parent.isEntity) return this.parent.parentStage();
        return null;
    }

    /** Returns parent world of an entity */
    parentWorld() {
        if (this.isWorld) return this;
        if (this.parent && this.parent.isEntity) return this.parent.parentWorld();
        return null;
    }

    removeFromParent() {
        const parent = this.parent;
        if (parent) parent.removeEntity(this);
        return this;
    }

    /******************** COPY */

    copy(source, recursive = true) {
        super.copy(source, recursive);

        // Properties
        this.category = source.category;
        this.locked = source.locked;
        this.visible = source.visible;

        // Components
        for (const component of source.components) {
            const clonedComponent = this.addComponent(component.type, component.toJSON(), false);
        }

        // Children
        if (recursive) {
            for (const child of source.getEntities()) {
                this.addEntity(child.clone());
            }
        }
        return this;
    }

    /******************** DISPOSE */

    dispose() {
        // Components
        while (this.components.length > 0) {
            const component = this.components[0];
            this.removeComponent(component);
            if (typeof component.dispose === 'function') component.dispose();
        }
        // Children
        while (this.children.length > 0) {
            this.children[0].dispose();
        }
        // Self
        this.removeFromParent();
        return this;
    }

    /******************** JSON */

    toJSON(recursive = true) {
        const data = super.toJSON(recursive);

        // Properties
        data.category = this.category;
        data.locked = this.locked;
        data.visible = this.visible;
        data.components = [];
        data.children = [];

        // Components
        for (const component of this.components) {
            data.components.push(component.toJSON());
        }

        // Children
        if (recursive) {
            for (const child of this.getEntities()) {
                data.children.push(child.toJSON(recursive));
            }
        }
        return data;
    }

    fromJSON(data) {
        super.fromJSON(data);

        // Entity
        if (data.category !== undefined) this.category = data.category;
        if (data.locked !== undefined) this.locked = data.locked;
        if (data.visible !== undefined) this.visible = data.visible;

        // Components
        if (data.components) {
            for (const componentData of data.components) {
                if (componentData && componentData.base && componentData.base.type) {
                    const component = this.addComponent(componentData.base.type, componentData, false);
                }
            }
        }

        // Children
        if (data.children) {
            for (const childData of data.children) {
                const Constructor = Thing.type(childData.type);
                if (Constructor) {
                    const child = new Constructor().fromJSON(childData);
                    this.addEntity(child);
                } else {
                    console.warn(`Entity.fromJSON(): Unknown child type '${childData.type}'`);
                }
            }
        }
        return this;
    }

}

Thing.register('Entity', Entity);

export { Entity };
