<script lang="ts" setup>
import Home2 from '~icons/tabler/home-2';
import Menu2 from '~icons/tabler/menu-2';
import { NIcon, useThemeVars } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { RouterLink } from 'vue-router';
import MenuLayout from '../components/MenuLayout.vue';
import NavbarButtons from '../components/NavbarButtons.vue';
import CollapsibleToolMenu from '@/components/CollapsibleToolMenu.vue';
import { config } from '@/config';
import { useStyleStore } from '@/stores/style.store';
import { terminalPalette } from '@/terminal-palette';
import { useToolStore } from '@/tools/tools.store';
import type { ToolCategory } from '@/tools/tools.types';

const themeVars = useThemeVars();
const styleStore = useStyleStore();
const palette = computed(() => (styleStore.isDarkTheme ? terminalPalette.dark : terminalPalette.light));
const version = config.app.version;
const commitSha = config.app.lastCommitSha.slice(0, 7);

// Expose the navbar height so the mobile menu (MenuLayout.vue) can position
// itself right under the always-visible top bar.
const navbarRef = ref<HTMLElement | null>(null);
const { height: navbarHeight } = useElementSize(navbarRef, undefined, { box: 'border-box' });
watchEffect(() => {
  document.documentElement.style.setProperty('--app-topbar-height', `${Math.round(navbarHeight.value)}px`);
});

const { t, locale } = useI18n();

const toolStore = useToolStore();
const { favoriteTools, toolsByCategory } = storeToRefs(toolStore);

const tools = computed<ToolCategory[]>(() => [
  ...(favoriteTools.value.length > 0
    ? [{ name: t('tools.categories.favorite-tools'), components: favoriteTools.value }]
    : []),
  ...toolsByCategory.value,
]);
</script>

<template>
  <MenuLayout class="menu-layout" :class="{ isSmallScreen: styleStore.isSmallScreen }">
    <template #sider>
      <RouterLink to="/" class="hero-wrapper">
        <div class="text-wrapper">
          <div class="title">
            <span class="prompt-user">pablo@systems</span><span class="prompt-sep">:</span
            ><span class="prompt-path">~/tools</span><span class="prompt-cursor" aria-hidden="true">_</span>
          </div>
          <div class="subtitle"># {{ $t('home.subtitle') }}</div>
        </div>
      </RouterLink>

      <div class="sider-content">
        <div v-if="styleStore.isSmallScreen" mb-24px flex justify-center>
          <NavbarButtons />
        </div>

        <CollapsibleToolMenu :tools-by-category="tools" />

        <div class="footer">
          <div>
            <span class="footer-prompt">$</span> it-tools

            <c-link target="_blank" rel="noopener" href="https://github.com/PabloVTM/it-tools"> v{{ version }} </c-link>

            <template v-if="commitSha && commitSha.length > 0">
              -
              <c-link
                target="_blank"
                rel="noopener"
                type="primary"
                :href="`https://github.com/PabloVTM/it-tools/tree/${commitSha}`"
              >
                {{ commitSha }}
              </c-link>
            </template>
          </div>
          <div>
            © {{ new Date().getFullYear() }}
            <c-link target="_blank" rel="noopener" href="https://corentin.tech?utm_source=it-tools&utm_medium=footer">
              Corentin Thomasset
            </c-link>
          </div>
          <div>
            forked by
            <c-link target="_blank" rel="noopener" href="https://github.com/sharevb/it-tools"> ShareVB </c-link>
            ·
            <c-link target="_blank" rel="noopener" href="https://github.com/PabloVTM"> PabloVTM </c-link>
          </div>
        </div>
      </div>
    </template>

    <template #content>
      <div ref="navbarRef" class="navbar" flex items-center justify-center gap-2>
        <c-button
          circle
          variant="text"
          :aria-label="$t('home.toggleMenu')"
          @click="styleStore.isMenuCollapsed = !styleStore.isMenuCollapsed"
        >
          <NIcon size="25" :component="Menu2" />
        </c-button>

        <c-tooltip :tooltip="$t('home.home')" position="bottom">
          <c-button to="/" circle variant="text" :aria-label="$t('home.home')">
            <NIcon size="25" :component="Home2" />
          </c-button>
        </c-tooltip>

        <c-tooltip :tooltip="$t('home.uiLib')" position="bottom">
          <c-button
            v-if="config.app.env === 'development'"
            to="/c-lib"
            circle
            variant="text"
            :aria-label="$t('home.uiLib')"
          >
            <icon-mdi:brush-variant text-20px />
          </c-button>
        </c-tooltip>

        <Suspense>
          <command-palette :key="locale" />
        </Suspense>

        <div>
          <NavbarButtons v-if="!styleStore.isSmallScreen" />
        </div>
      </div>
      <!-- Positioned wrapper so the route-change loading overlay (see router.ts)
           can cover just the page, leaving the nav bar and menu visible. -->
      <div class="page-content">
        <slot />
      </div>
    </template>
  </MenuLayout>
</template>

<style lang="less" scoped>
// ::v-deep(.n-layout-scroll-container) {
//     @percent: 4%;
//     @position: 25px;
//     @size: 50px;
//     @color: #eeeeee25;
//     background-image: radial-gradient(@color @percent, transparent @percent),
//         radial-gradient(@color @percent, transparent @percent);
//     background-position: 0 0, @position @position;
//     background-size: @size @size;
// }

.footer {
  text-align: center;
  color: v-bind('palette.textMuted');
  margin-top: 20px;
  padding: 20px 0;
  font-size: 12px;
  line-height: 1.8;

  .footer-prompt {
    color: v-bind('palette.accentText');
  }
}

.sider-content {
  padding-top: 20px;
  padding-bottom: 50px;

  @media (max-width: 700px) {
    // The hero block above provides the symmetric 24px gap
    padding-top: 0;
  }
}

.page-content {
  position: relative;
}

// Mobile: the top bar stays visible while scrolling, and the full-width menu
// (see MenuLayout.vue) opens right under it.
.navbar {
  @media (max-width: 700px) {
    position: sticky;
    top: 0;
    z-index: 20;
    // Bleed over the scroll container's 13px padding so content scrolls
    // under an opaque, full-width bar.
    margin: -13px -13px 13px;
    padding: 13px;
    background-color: v-bind('themeVars.bodyColor');
  }
}

.hero-wrapper {
  position: sticky;
  display: flex;
  top: 0;
  left: 0;
  z-index: 10;
  width: inherit;
  padding: 22px 18px 16px;
  text-decoration: none;
  background-color: v-bind('palette.surface');
  border-bottom: 1px solid v-bind('palette.border');

  .text-wrapper {
    width: 100%;
    text-align: left;

    .title {
      font-size: 15px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      .prompt-user {
        color: v-bind('palette.primary');
      }

      .prompt-sep {
        color: v-bind('palette.textMuted');
      }

      .prompt-path {
        color: v-bind('palette.accentText');
      }

      .prompt-cursor {
        color: v-bind('palette.accent');
        animation: prompt-blink 1.1s steps(1) infinite;
      }
    }

    .subtitle {
      margin-top: 6px;
      font-size: 12px;
      color: v-bind('palette.textMuted');
    }
  }

  // Mobile: the header scrolls with the full-width menu.
  @media (max-width: 700px) {
    position: static;
    padding: 24px 18px;
    border-bottom: none;
    background-color: transparent;
  }
}

@keyframes prompt-blink {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-wrapper .text-wrapper .title .prompt-cursor {
    animation: none;
  }
}
</style>
