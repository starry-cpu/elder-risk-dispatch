import { defineConfig, presetUno, presetAttributify } from 'unocss';

export default defineConfig({
  presets: [presetUno(), presetAttributify()],
  shortcuts: {
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
  },
  theme: {
    colors: {
      brand: {
        gold: '#b8860b',
        'gold-light': '#d4a535',
        'gold-soft': '#fef7e6',
        ink: '#1a1f2e',
      },
      surface: {
        paper: '#faf8f5',
        card: '#ffffff',
      },
      text: {
        primary: '#2c2c2c',
        secondary: '#6b6b6b',
        muted: '#999999',
      },
      func: {
        success: '#6b8f71',
        warning: '#d4956a',
        danger: '#c4554d',
        info: '#7b8fa1',
      },
    },
  },
});
