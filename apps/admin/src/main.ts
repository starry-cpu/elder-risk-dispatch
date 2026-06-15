import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import ElementPlus from 'element-plus';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';
import 'element-plus/dist/index.css';
import './styles/theme.css';
import 'uno.css';

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.use(ElementPlus);
app.use(router);

// 挂载前回填 user：刷新后 token 仍在但内存 user 为 null，这里用 getMe() 补齐；
// token 无效则 logout()，让 App.vue 切回登录视图。代价是一次 GET（首屏几十 ms）。
const authStore = useAuthStore();
await authStore.hydrate();

app.mount('#app');
