import { h } from 'vue';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import * as mdiPaths from '@mdi/js';
import { icons } from './mdi-icon'; // Import icons from separate file
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { PurpleTheme } from '@/theme/LightTheme';

function resolveMdiSvgIcon(icon: unknown): unknown {
  if (typeof icon !== 'string') return icon;
  if (icon.startsWith('svg:')) return icon;
  if (!icon.startsWith('mdi-')) return icon;

  const exportName = `mdi${icon
    .slice(4)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}`;

  return (mdiPaths as Record<string, string>)[exportName] || icon;
}

const mdiCompat = {
  component: (props: any) =>
    h((mdi as any).component, {
      ...props,
      icon: resolveMdiSvgIcon(props.icon)
    })
} as typeof mdi;

export default createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases: {
      ...aliases,
      ...icons
    },
    sets: {
      mdi: mdiCompat
    }
  },
  theme: {
    defaultTheme: 'PurpleTheme',
    themes: {
      PurpleTheme
    }
  },
  defaults: {
    VBtn: {},
    VCard: {
      rounded: 'md'
    },
    VTextField: {
      rounded: 'lg'
    },
    VTooltip: {
      // set v-tooltip default location to top
      location: 'top'
    }
  }
});
