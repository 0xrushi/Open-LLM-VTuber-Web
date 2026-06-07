import { SystemStyleObject } from '@chakra-ui/react';

interface FooterStyles {
  container: (isCollapsed: boolean) => SystemStyleObject
  toggleButton: SystemStyleObject
  actionButton: SystemStyleObject
  input: SystemStyleObject
  attachButton: SystemStyleObject
}

interface AIIndicatorStyles {
  container: SystemStyleObject
  text: SystemStyleObject
}

export const footerStyles: {
  footer: FooterStyles
  aiIndicator: AIIndicatorStyles
} = {
  footer: {
    container: (isCollapsed) => ({
      bg: isCollapsed ? 'transparent' : 'var(--hermes-surface)',
      borderTopRadius: isCollapsed ? 'none' : '0',
      borderTop: isCollapsed ? 'none' : '1px solid',
      borderColor: 'var(--hermes-border)',
      transform: isCollapsed ? 'translateY(calc(100% - 24px))' : 'translateY(0)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      height: '100%',
      position: 'relative',
      overflow: isCollapsed ? 'visible' : 'hidden',
      pb: '4',
    }),
    toggleButton: {
      height: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: 'var(--hermes-text-muted)',
      _hover: { color: 'var(--hermes-accent-strong)', bg: 'var(--hermes-surface-muted)' },
      bg: 'transparent',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    actionButton: {
      borderRadius: '0',
      width: '50px',
      height: '50px',
      minW: '50px',
      border: '1px solid',
      borderColor: 'var(--hermes-border)',
      color: 'var(--hermes-accent-contrast)',
      boxShadow: '3px 3px 0 var(--hermes-border)',
      _hover: {
        transform: 'translate(1px, 1px)',
        boxShadow: '2px 2px 0 var(--hermes-border)',
      },
    },
    input: {
      bg: 'var(--hermes-surface-raised)',
      border: '1px solid',
      borderColor: 'var(--hermes-border)',
      height: '80px',
      borderRadius: '0',
      fontSize: '16px',
      fontFamily: 'var(--hermes-font-mono)',
      pl: '12',
      pr: '4',
      color: 'var(--hermes-text)',
      _placeholder: {
        color: 'var(--hermes-text-muted)',
      },
      _focus: {
        borderColor: 'var(--hermes-accent)',
        bg: 'var(--hermes-surface-raised)',
        boxShadow: 'var(--hermes-shadow)',
      },
      resize: 'none',
      minHeight: '80px',
      maxHeight: '80px',
      py: '0',
      display: 'flex',
      alignItems: 'center',
      paddingTop: '28px',
      lineHeight: '1.4',
    },
    attachButton: {
      position: 'absolute',
      left: '1',
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--hermes-text-muted)',
      zIndex: 2,
      _hover: {
        bg: 'transparent',
        color: 'var(--hermes-accent-strong)',
      },
    },
  },
  aiIndicator: {
    container: {
      bg: 'var(--hermes-accent-strong)',
      color: 'var(--hermes-accent-contrast)',
      width: '110px',
      height: '30px',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
      overflow: 'hidden',
    },
    text: {
      fontSize: '12px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },
};
