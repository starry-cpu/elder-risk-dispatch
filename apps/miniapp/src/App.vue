<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
onLaunch(() => { console.log('App Launch'); });
</script>

<style lang="scss">
/* 全局引入 wot-design-uni 主题覆盖（reset.scss）。
   注意：必须是全局样式（非 scoped），故写在 App.vue 根 <style> 中。 */
@import './styles/reset.scss';
</style>
