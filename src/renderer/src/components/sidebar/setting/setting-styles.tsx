const isElectron = window.api !== undefined;
export const settingStyles = {
  settingUI: {
    container: {
      width: '100%',
      height: '100%',
      p: 4,
      gap: 4,
      position: 'relative',
      overflowY: 'auto',
      css: {
        '&::-webkit-scrollbar': {
          width: '4px',
        },
        '&::-webkit-scrollbar-track': {
          bg: 'var(--hermes-surface-muted)',
          borderRadius: 'full',
        },
        '&::-webkit-scrollbar-thumb': {
          bg: 'var(--hermes-accent)',
          borderRadius: 'full',
        },
      },
    },
    header: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    },
    title: {
      ml: 4,
      fontSize: 'lg',
      fontWeight: 'bold',
    },
    tabs: {
      root: {
        width: '100%',
        variant: 'plain' as const,
        colorPalette: 'gray',
      },
      content: {
        pt: 2,
        pb: '128px',
      },
      trigger: {
        minH: '38px',
        h: '38px',
        px: 3,
        py: 0,
        flex: '1 1 104px',
        justifyContent: 'center',
        color: 'var(--hermes-text-muted)',
        bg: 'var(--hermes-surface)',
        border: '1px solid',
        borderColor: 'var(--hermes-border-muted)',
        borderRadius: '0',
        fontFamily: 'var(--hermes-font-mono)',
        fontSize: '12px',
        fontWeight: '700',
        lineHeight: '1',
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        _selected: {
          color: 'var(--hermes-accent-contrast)',
          bg: 'var(--hermes-accent-strong)',
          borderColor: 'var(--hermes-accent-strong)',
        },
        _hover: {
          color: 'var(--hermes-text)',
          bg: 'var(--hermes-surface-muted)',
          borderColor: 'var(--hermes-border)',
        },
      },
      list: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        justifyContent: 'flex-start',
        width: '100%',
        gap: 2,
        borderBottom: '1px solid',
        borderColor: 'var(--hermes-border-muted)',
        mb: 4,
        pb: 4,
        pl: 0,
      },
    },
    footer: {
      width: '100%',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 2,
      mt: 'auto',
      pt: 4,
      borderTop: '1px solid',
      borderColor: 'var(--hermes-border-muted)',
    },
    drawerContent: {
      bg: 'var(--hermes-surface)',
      maxWidth: '440px',
      height: isElectron ? 'calc(100vh - 30px)' : '100vh',
      borderLeft: '1px solid',
      borderColor: 'var(--hermes-border-muted)',
      overflow: 'hidden',
    },
    drawerBody: {
      overflowY: 'auto' as const,
      pb: 0,
      css: {
        '&::-webkit-scrollbar': {
          width: '4px',
        },
        '&::-webkit-scrollbar-track': {
          bg: 'var(--hermes-surface-muted)',
        },
        '&::-webkit-scrollbar-thumb': {
          bg: 'var(--hermes-accent)',
        },
      },
    },
    drawerFooter: {
      bg: 'var(--hermes-surface)',
      borderTop: '1px solid',
      borderColor: 'var(--hermes-border-muted)',
      gap: 3,
      px: 6,
      py: 4,
    },
    footerButton: {
      borderRadius: '0',
      fontFamily: 'var(--hermes-font-mono)',
      fontWeight: '700',
    },
    drawerHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      position: 'relative',
      px: 6,
      py: 4,
    },
    drawerTitle: {
      color: 'var(--hermes-text)',
      fontFamily: 'var(--hermes-font-display)',
      fontSize: '2xl',
      fontWeight: 'normal',
    },
    closeButton: {
      position: 'absolute',
      right: 1,
      top: 1,
      color: 'var(--hermes-text)',

    },
  },
  general: {
    container: {
      align: 'stretch',
      gap: 6,
      p: 4,
    },
    field: {
      label: {
        color: 'var(--hermes-text-muted)',
        fontFamily: 'var(--hermes-font-mono)',
        fontSize: '13px',
        letterSpacing: '0.04em',
      },
    },
    select: {
      root: {
        colorPalette: 'gray',
        width: '100%',
      },
      trigger: {
        minH: '40px',
        bg: 'var(--hermes-surface-raised)',
        color: 'var(--hermes-text)',
        border: '1px solid',
        borderColor: 'var(--hermes-border)',
        borderRadius: '0',
        fontFamily: 'var(--hermes-font-mono)',
        _hover: {
          bg: 'var(--hermes-surface-muted)',
          borderColor: 'var(--hermes-accent)',
        },
      },
      content: {
        bg: 'var(--hermes-surface-raised)',
        color: 'var(--hermes-text)',
        border: '1px solid',
        borderColor: 'var(--hermes-border)',
        borderRadius: '0',
        fontFamily: 'var(--hermes-font-mono)',
      },
      item: {
        color: 'var(--hermes-text)',
        _highlighted: {
          bg: 'var(--hermes-surface-muted)',
        },
      },
    },
    input: {
      minH: '40px',
      bg: 'var(--hermes-surface-raised)',
      color: 'var(--hermes-text)',
      border: '1px solid',
      borderColor: 'var(--hermes-border)',
      borderRadius: '0',
      fontFamily: 'var(--hermes-font-mono)',
      _placeholder: {
        color: 'var(--hermes-text-muted)',
      },
      _hover: {
        bg: 'var(--hermes-surface-muted)',
        borderColor: 'var(--hermes-accent)',
      },
      _disabled: {
        opacity: 0.65,
        bg: 'var(--hermes-surface-muted)',
      },
    },
    buttonGroup: {
      gap: 4,
      width: '100%',
    },
    button: {
      width: '50%',
      variant: 'outline' as const,
      bg: 'var(--hermes-accent-strong)',
      color: 'var(--hermes-accent-contrast)',
      borderRadius: '0',
      border: '1px solid',
      borderColor: 'var(--hermes-border)',
      _hover: {
        bg: 'var(--hermes-surface-raised)',
        color: 'var(--hermes-text)',
      },
    },
    fieldLabel: {
      fontSize: '14px',
      color: 'gray.600',
    },
  },
  common: {
    field: {
      orientation: 'horizontal' as const,
    },
    fieldLabel: {
      fontSize: 'sm',
      color: 'var(--hermes-text-muted)',
      fontFamily: 'var(--hermes-font-mono)',
      whiteSpace: 'nowrap' as const,
    },
    switch: {
      size: 'md' as const,
      colorPalette: 'green' as const,
      variant: 'solid' as const,
    },
    numberInput: {
      root: {
        pattern: '[0-9]*\\.?[0-9]*',
        inputMode: 'decimal' as const,
      },
      input: {
        bg: 'var(--hermes-surface-raised)',
        color: 'var(--hermes-text)',
        borderColor: 'var(--hermes-border)',
        borderRadius: '0',
        _hover: {
          bg: 'var(--hermes-surface-muted)',
          borderColor: 'var(--hermes-accent)',
        },
      },
    },
    container: {
      gap: 8,
      maxW: '100%',
      css: { '--field-label-width': '150px' },
    },
    input: {
      bg: 'var(--hermes-surface-raised)',
      color: 'var(--hermes-text)',
      borderColor: 'var(--hermes-border)',
      borderRadius: '0',
      _hover: {
        bg: 'var(--hermes-surface-muted)',
        borderColor: 'var(--hermes-accent)',
      },
    },
  },
  live2d: {
    container: {
      gap: 8,
      maxW: 'sm',
      css: { '--field-label-width': '120px' },
    },
    emotionMap: {
      title: {
        fontWeight: 'bold',
        mb: 4,
      },
      entry: {
        mb: 2,
      },
      button: {
        colorPalette: 'blue',
        mt: 2,
      },
      deleteButton: {
        colorPalette: 'red',
      },
    },
  },
};
