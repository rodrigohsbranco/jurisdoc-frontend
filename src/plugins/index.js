/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */
import router from '../router';
import pinia from '../stores';
// Plugins
import vuetify from './vuetify';
export function registerPlugins(app) {
    app
        .use(vuetify)
        .use(router)
        .use(pinia);
}
