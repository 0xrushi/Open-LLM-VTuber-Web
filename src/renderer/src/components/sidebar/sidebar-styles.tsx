import { css } from '@emotion/react';

const isElectron = window.api !== undefined;

const commonStyles = {
  scrollbar: {
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
  panel: {
    border: '1px solid',
    borderColor: 'var(--hermes-border)',
    borderRadius: '0',
    bg: 'var(--hermes-surface)',
    boxShadow: 'var(--hermes-shadow)',
  },
  title: {
    fontFamily: 'var(--hermes-font-display)',
    fontSize: '2xl',
    fontWeight: 'normal',
    color: 'var(--hermes-text)',
    mb: 4,
  },
};

const nousButton = {
  borderRadius: '0',
  border: '1px solid',
  borderColor: 'var(--hermes-border)',
  bg: 'var(--hermes-surface-raised)',
  color: 'var(--hermes-text)',
  minW: '38px',
  height: '34px',
  fontFamily: 'var(--hermes-font-mono)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.01em',
  boxShadow: '2px 2px 0 var(--hermes-border)',
  _hover: {
    bg: 'var(--hermes-accent-strong)',
    color: 'var(--hermes-accent-contrast)',
    transform: 'translate(1px, 1px)',
    boxShadow: '1px 1px 0 var(--hermes-border)',
  },
  _active: {
    transform: 'translate(2px, 2px)',
    boxShadow: 'none',
  },
};

export const sidebarStyles = {
  sidebar: {
    container: (isCollapsed: boolean) => ({
      position: 'absolute' as const,
      left: 0,
      top: 0,
      height: '100%',
      width: { base: '100%', md: '440px' },
      maxWidth: { base: '100%', md: '40vw', lg: '440px' },
      bg: 'var(--hermes-surface)',
      transform: isCollapsed
        ? 'translateX(calc(-100% + 24px))'
        : 'translateX(0)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4,
      overflow: isCollapsed ? 'visible' : 'hidden',
      pb: '4',
      zIndex: 10,
    }),
    toggleButton: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: '24px',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: 'var(--hermes-text-muted)',
      _hover: { color: 'var(--hermes-accent-strong)', bg: 'var(--hermes-surface-muted)' },
      bg: 'transparent',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      zIndex: 1,
    },
    content: {
      flex: 1,
      width: '100%',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 4,
      overflow: 'hidden',
    },
    header: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      p: 2,
      borderBottom: '1px solid',
      borderColor: 'var(--hermes-border-muted)',
    },
    headerButton: nousButton,
  },

  chatHistoryPanel: {
    container: {
      flex: 1,
      overflow: 'hidden',
      px: 4,
      display: 'flex',
      flexDirection: 'column',
    },
    title: commonStyles.title,
    messageList: {
      ...commonStyles.panel,
      p: 4,
      width: '97%',
      flex: 1,
      overflowY: 'auto',
      css: {
        ...commonStyles.scrollbar,
        scrollPaddingBottom: '1rem',
      },
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    },
  },

  systemLogPanel: {
    container: {
      width: '100%',
      overflow: 'hidden',
      px: 4,
      minH: '200px',
      marginTop: 'auto',
    },
    title: commonStyles.title,
    logList: {
      ...commonStyles.panel,
      p: 4,
      height: '200px',
      overflowY: 'auto',
      fontFamily: 'mono',
      css: commonStyles.scrollbar,
    },
    entry: {
      p: 2,
      borderRadius: 'md',
      _hover: {
        bg: 'whiteAlpha.50',
      },
    },
  },

  chatBubble: {
    container: {
      display: 'flex',
      position: 'relative',
      _hover: {
        bg: 'whiteAlpha.50',
      },
      py: 1,
      px: 2,
      borderRadius: 'md',
    },
    message: {
      maxW: '90%',
      bg: 'transparent',
      p: 2,
    },
    text: {
      fontSize: 'xs',
      color: 'var(--hermes-text)',
    },
    dot: {
      position: 'absolute',
      w: '2',
      h: '2',
      borderRadius: 'full',
      bg: 'white',
      top: '2',
    },
  },

  historyDrawer: {
    listContainer: {
      flex: 1,
      overflowY: 'auto',
      px: 4,
      py: 2,
      css: commonStyles.scrollbar,
    },
    historyItem: {
      mb: 4,
      p: 3,
      borderRadius: '0',
      border: '1px solid',
      borderColor: 'var(--hermes-border-muted)',
      bg: 'var(--hermes-surface-raised)',
      cursor: 'pointer',
      transition: 'all 0.2s',
      _hover: {
        bg: 'var(--hermes-surface-muted)',
        borderColor: 'var(--hermes-border)',
      },
    },
    historyItemSelected: {
      bg: 'var(--hermes-surface-muted)',
      borderLeft: '3px solid',
      borderColor: 'var(--hermes-accent-strong)',
    },
    historyHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: 2,
    },
    timestamp: {
      fontSize: 'sm',
      color: 'var(--hermes-text-muted)',
      fontFamily: 'var(--hermes-font-mono)',
    },
    deleteButton: {
      variant: 'outline' as const,
      size: 'sm' as const,
      color: 'var(--hermes-danger)',
      borderColor: 'var(--hermes-border-muted)',
      borderRadius: '0',
      opacity: 0.9,
      _hover: {
        opacity: 1,
        bg: 'var(--hermes-surface-muted)',
      },
    },
    messagePreview: {
      fontSize: 'sm',
      color: 'var(--hermes-text)',
      noOfLines: 2,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    drawer: {
      content: {
        background: 'var(--hermes-surface)',
        borderRight: '1px solid var(--hermes-border-muted)',
        maxWidth: '440px',
        marginTop: isElectron ? '30px' : '0',
        height: isElectron ? 'calc(100vh - 30px)' : '100vh',
      },
      title: {
        color: 'var(--hermes-text)',
        fontFamily: 'var(--hermes-font-display)',
        fontSize: '24px',
        fontWeight: '400',
      },
      closeButton: {
        color: 'var(--hermes-text)',
      },
      actionButton: {
        color: 'var(--hermes-text)',
        bg: 'var(--hermes-surface-raised)',
        borderColor: 'var(--hermes-border)',
        borderRadius: '0',
        variant: 'outline' as const,
        _hover: {
          bg: 'var(--hermes-surface-muted)',
        },
      },
    },
  },

  cameraPanel: {
    container: {
      width: '97%',
      overflow: 'hidden',
      px: 4,
      minH: '240px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: 4,
    },
    title: commonStyles.title,
    videoContainer: {
      ...commonStyles.panel,
      width: '100%',
      height: '240px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      transition: 'all 0.2s',
    },
    video: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
      transform: 'scaleX(-1)',
      borderRadius: '8px',
      display: 'block',
    } as const,
  },

  screenPanel: {
    container: {
      width: '97%',
      overflow: 'hidden',
      px: 4,
      minH: '240px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: 4,
    },
    title: commonStyles.title,
    screenContainer: {
      ...commonStyles.panel,
      width: '100%',
      height: '240px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      transition: 'all 0.2s',
    },
    video: {
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
      borderRadius: '8px',
      display: 'block',
    } as const,
  },

  // Add Browser Panel Styles
  browserPanel: {
    container: {
      width: '97%',
      overflow: 'hidden',
      px: 4,
      minH: '240px',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      mb: 4,
    },
    title: commonStyles.title,
    browserContainer: {
      ...commonStyles.panel,
      width: '100%',
      height: '240px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      transition: 'all 0.2s',
      cursor: 'pointer',
      _hover: {
        bg: 'whiteAlpha.100',
      },
    },
    iframe: {
      width: '100%',
      height: '100%',
      border: 'none',
      borderRadius: '8px',
    } as const,
  },

  bottomTab: {
    container: {
      width: '97%',
      px: 4,
      position: 'relative' as const,
      zIndex: 0,
    },
    tabs: {
      width: '100%',
      bg: 'var(--hermes-surface-muted)',
      borderRadius: '0',
      border: '1px solid',
      borderColor: 'var(--hermes-border)',
      p: '1',
    },
    list: {
      borderBottom: 'none',
      gap: '2',
    },
    trigger: {
      color: 'var(--hermes-text-muted)',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      px: 3,
      py: 2,
      borderRadius: '0',
      fontFamily: 'var(--hermes-font-mono)',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.02em',
      _hover: {
        color: 'var(--hermes-text)',
        bg: 'var(--hermes-surface-raised)',
      },
      _selected: {
        color: 'var(--hermes-accent-contrast)',
        bg: 'var(--hermes-accent-strong)',
      },
    },
  },

  groupDrawer: {
    section: {
      mb: 6,
    },
    sectionTitle: {
      fontSize: 'lg',
      fontWeight: 'semibold',
      color: 'white',
      mb: 3,
    },
    inviteBox: {
      display: 'flex',
      gap: 2,
    },
    input: {
      bg: 'whiteAlpha.100',
      border: 'none',
      color: 'white',
      _placeholder: {
        color: 'whiteAlpha.400',
      },
    },
    memberList: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    },
    memberItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      p: 2,
      borderRadius: 'md',
      bg: 'whiteAlpha.100',
    },
    memberText: {
      color: 'white',
      fontSize: 'sm',
    },
    removeButton: {
      size: 'sm',
      color: 'red.300',
      bg: 'transparent',
      _hover: {
        bg: 'whiteAlpha.200',
      },
    },
    button: {
      color: 'white',
      bg: 'whiteAlpha.100',
      _hover: {
        bg: 'whiteAlpha.200',
      },
    },
    clipboardButton: {
      color: 'white',
      bg: 'transparent',
      _hover: {
        bg: 'whiteAlpha.200',
      },
      size: 'sm',
    },
  },

  // Add styles for the Tool Call Indicator
  toolCallIndicator: {
    container: {
      pl: '44px', // Indent to align with message content (avatar width + gap)
      my: '1', // Reduced vertical margin (e.g., 4px if theme space 1 = 4px)
      gap: 2,
      width: '100%',
      minHeight: '24px', // Ensure minimum height
      display: 'flex', // Ensure display is flex
      alignItems: 'center', // Keep vertical alignment
      justifyContent: 'center', // Center items horizontally
    },
    icon: {
      color: 'var(--hermes-accent)',
      boxSize: '14px',
    },
    text: {
      fontSize: 'xs',
      color: 'var(--hermes-text-muted)',
      fontStyle: 'italic',
    },
    spinner: {
      size: 'xs',
      color: 'var(--hermes-accent)',
      ml: 0,
    },
    completedIcon: {
      color: 'var(--hermes-accent)',
      boxSize: '14px',
      ml: 0,
    },
    errorIcon: {
      color: 'var(--hermes-danger)',
      boxSize: '14px',
      ml: 0,
    },
  },
};

export const chatPanelStyles = css`
  .cs-message-list {
    background: var(--hermes-surface) !important;
    padding: var(--chakra-space-4);
  }
  
  .cs-message {
    margin: 12px 0;
    // padding-top: 20px !important;
  }

  .cs-message__content {
    background-color: var(--hermes-surface-raised) !important;
    border: 1px solid var(--hermes-border-muted) !important;
    border-radius: 0 !important;
    padding: 8px !important;
    color: var(--hermes-text) !important;
    font-family: var(--hermes-font-mono) !important;
    font-size: 0.95rem !important;
    line-height: 1.5 !important;
    margin-top: 4px !important;
  }

  .cs-message__text {
    padding: 8px 0 !important;
  }

  .cs-message--outgoing .cs-message__content {
    background-color: var(--hermes-surface-muted) !important;
    border-color: var(--hermes-accent) !important;
  }

  .cs-chat-container {
    background: transparent !important;
    border: 1px solid var(--hermes-border);
    border-radius: 0;
    padding: var(--chakra-space-2);
  }

  .cs-main-container {
    border: none !important;
    background: transparent !important;
    width: calc(100% - 24px) !important;
    margin-left: 0 !important;
  }

  .cs-message__sender {
    position: absolute !important;
    top: 0 !important;
    left: 36px !important;
    font-size: 0.875rem !important;
    font-weight: 600 !important;
    color: var(--hermes-text-muted) !important;
    font-family: var(--hermes-font-mono) !important;
  }

  .cs-message__content-wrapper {
    max-width: 80%;
    margin: 0 8px;
  }

  .cs-avatar {
    background-color: var(--hermes-accent-strong) !important;
    color: var(--hermes-accent-contrast) !important;
    width: 28px !important;
    height: 28px !important;
    font-size: 14px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    border-radius: 0 !important;
    border: 1px solid var(--hermes-border) !important;
    font-family: var(--hermes-font-mono) !important;
  }

  .cs-message--outgoing .cs-avatar {
    background-color: var(--hermes-surface-muted) !important;
    color: var(--hermes-text) !important;
  }

  .cs-message__header {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
`;
