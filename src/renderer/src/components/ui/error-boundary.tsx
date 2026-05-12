import React, { Component, ErrorInfo, ReactNode } from "react";
import { Box, Heading, Text, Button, VStack } from "@chakra-ui/react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Box
          height="100vh"
          width="100vw"
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="gray.900"
          color="white"
          p={4}
        >
          <VStack gap={4} textAlign="center">
            <Heading size="lg">Something went wrong</Heading>
            <Text color="whiteAlpha.700" fontSize="sm">
              The application encountered an error and could not continue.
            </Text>
            <Box
              bg="blackAlpha.400"
              p={3}
              borderRadius="md"
              fontSize="xs"
              fontFamily="mono"
              maxW="90vw"
              overflow="auto"
            >
              {this.state.error?.message}
            </Box>
            <Button
              colorScheme="blue"
              onClick={() => window.location.reload()}
            >
              Reload Application
            </Button>
          </VStack>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
