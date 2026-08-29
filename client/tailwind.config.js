/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: 'var(--bg-app)',
          surface: 'var(--bg-surface)',
          'surface-soft': 'var(--bg-surface-soft)',
          'surface-blue': 'var(--bg-surface-blue)',
          'surface-hover': 'var(--bg-surface-hover)',
          border: 'var(--border-color)',
          'border-strong': 'var(--border-strong)',
          'border-active': 'var(--border-active)',
          primary: 'var(--primary)',
          'primary-hover': 'var(--primary-hover)',
          'primary-dark': 'var(--primary-dark)',
          'primary-soft': 'var(--primary-soft)',
          'primary-text': 'var(--primary-text)',
          'text-primary': 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          success: 'var(--success)',
          'success-soft': 'var(--success-soft)',
          'success-text': 'var(--success-text)',
          warning: 'var(--warning)',
          'warning-soft': 'var(--warning-soft)',
          'warning-text': 'var(--warning-text)',
          danger: 'var(--danger)',
          'danger-soft': 'var(--danger-soft)',
          'danger-text': 'var(--danger-text)',
        }
      },
      borderRadius: {
        'card': '20px',
        'subcard': '16px',
        'btn': '12px',
        'input': '12px'
      },
      boxShadow: {
        'saas': 'var(--card-shadow)',
        'saas-lg': '0 10px 30px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.03)',
      }
    }
  },
  plugins: []
};
