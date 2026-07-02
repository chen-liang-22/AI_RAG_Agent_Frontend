<script setup lang="ts">
import { computed } from 'vue'
import { KeyRound, LoaderCircle, LogIn, Moon, ShieldCheck, Sun, UserRound } from 'lucide-vue-next'
import type { ThemeMode } from './navigation'

const props = defineProps<{
  themeMode: ThemeMode
  authRestoring: boolean
  authLoading: boolean
  authError: string
  username: string
  password: string
  submitDisabled: boolean
}>()

const emit = defineEmits<{
  'update:themeMode': [value: ThemeMode]
  'update:username': [value: string]
  'update:password': [value: string]
  login: []
}>()

const themeToggleIcon = computed(() => (props.themeMode === 'dark' ? Sun : Moon))

function toggleTheme() {
  emit('update:themeMode', props.themeMode === 'dark' ? 'light' : 'dark')
}
</script>

<template>
  <main class="login-gate" :class="`theme-${themeMode}`">
    <button class="login-theme-button" type="button" @click="toggleTheme">
      <component :is="themeToggleIcon" :size="18" />
      <span>{{ themeMode === 'dark' ? '浅色模式' : '深色模式' }}</span>
    </button>

    <section class="login-card" aria-label="系统登录">
      <div class="login-brand">
        <span class="login-mark"><ShieldCheck :size="26" /></span>
        <div>
          <strong>知习台安全入口</strong>
          <p>AI RAG Agent · 训练与知识工作台</p>
        </div>
      </div>

      <div class="login-copy">
        <span>身份认证</span>
        <h1>进入智能知识中枢</h1>
        <p>登录后可访问智能客服、知识库管理、销售陪练和问答考试。</p>
      </div>

      <div v-if="authRestoring" class="login-restoring">
        <LoaderCircle class="spin" :size="28" />
        <span>正在恢复登录状态...</span>
      </div>

      <form v-else class="login-form" @submit.prevent="emit('login')">
        <label class="login-field">
          <span><UserRound :size="16" /> 登录账号</span>
          <input
            :value="username"
            autocomplete="username"
            placeholder="请输入账号"
            type="text"
            @input="emit('update:username', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="login-field">
          <span><KeyRound :size="16" /> 登录密码</span>
          <input
            :value="password"
            autocomplete="current-password"
            placeholder="请输入密码"
            type="password"
            @input="emit('update:password', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <p v-if="authError" class="login-error">{{ authError }}</p>

        <button class="login-submit" :disabled="submitDisabled" type="submit">
          <LoaderCircle v-if="authLoading" class="spin" :size="18" />
          <LogIn v-else :size="18" />
          <span>{{ authLoading ? '正在校验' : '进入系统' }}</span>
        </button>
      </form>
    </section>

    <aside class="login-status-panel">
      <div>
        <strong>访问令牌</strong>
        <span>JWT · 30 分钟</span>
      </div>
      <div>
        <strong>续签会话</strong>
        <span>HttpOnly Cookie · Redis · 7 天</span>
      </div>
    </aside>
  </main>
</template>
