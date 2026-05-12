/* eslint-disable no-shadow */
// import { StrictMode } from 'react';
import { Box, Flex, ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { useState, useEffect, useRef, useMemo } from "react";
// import Canvas from './components/canvas/canvas'; // Likely unused now
import Sidebar from "./components/sidebar/sidebar";
import Footer from "./components/footer/footer";
import { AiStateProvider } from "./context/ai-state-context";
import { Live2DConfigProvider, useLive2DConfig } from "./context/live2d-config-context";
import { SubtitleProvider } from "./context/subtitle-context";
import { BgUrlProvider } from "./context/bgurl-context";
import { layoutStyles } from "./layout";
import WebSocketHandler from "./services/websocket-handler";
import { CameraProvider } from "./context/camera-context";
import { ChatHistoryProvider } from "./context/chat-history-context";
import { CharacterConfigProvider } from "./context/character-config-context";
import { Toaster } from "./components/ui/toaster";
import { VADProvider } from "./context/vad-context";
import { Live2D } from "./components/canvas/live2d";
import { VrmViewer } from "./components/canvas/vrm-viewer";
import { MediaPipeController } from "./components/canvas/mediapipe-controller";
import TitleBar from "./components/electron/title-bar";
import { InputSubtitle } from "./components/electron/input-subtitle";
import { ProactiveSpeakProvider } from "./context/proactive-speak-context";
import { ScreenCaptureProvider } from "./context/screen-capture-context";
import { GroupProvider } from "./context/group-context";
import { BrowserProvider } from "./context/browser-context";
// eslint-disable-next-line import/no-extraneous-dependencies, import/newline-after-import
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { FiMenu } from "react-icons/fi";
import Background from "./components/canvas/background";
import WebSocketStatus from "./components/canvas/ws-status";
import Subtitle from "./components/canvas/subtitle";
import { ModeProvider, useMode } from "./context/mode-context";
import ErrorBoundary from "./components/ui/error-boundary";

function AppContent(): JSX.Element {
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 1024);
  const [isFooterCollapsed, setIsFooterCollapsed] = useState(false);
  const [showFloatingControls, setShowFloatingControls] = useState(true);
  const { mode } = useMode();
  const { modelInfo } = useLive2DConfig();
  const isElectron = window.api !== undefined;
  const live2dContainerRef = useRef<HTMLDivElement>(null);

  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
      setIsSmallScreen(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

    
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.documentElement.style.height = '100%';
  document.body.style.height = '100%';
  document.documentElement.style.position = 'fixed';
  document.body.style.position = 'fixed';
  document.documentElement.style.width = '100%';
  document.body.style.width = '100%';

  // Define base style properties shared across modes/breakpoints
  const live2dBaseStyle = {
    position: "absolute" as const,
    overflow: "hidden",
    transition: "all 0.3s ease-in-out", // Optional transition
    pointerEvents: "auto" as const,
  };

  // Define styles specifically for the "window" mode, using responsive syntax
  const getResponsiveLive2DWindowStyle = (sidebarVisible: boolean) => ({
    ...live2dBaseStyle,
    top: isElectron ? "30px" : "0px",
    height: `calc(100% - ${isElectron ? "30px" : "0px"})`,
    zIndex: 5, // Ensure it's layered correctly below UI but above background
    left: {
      base: "0px", // Column layout (base): Start from left edge
      md: sidebarVisible ? "440px" : "0px", // Row layout (md+): Offset by sidebar width or full screen
    },
    width: {
      base: "100%", // Column layout (base): Full width
      md: sidebarVisible ? "calc(100% - 440px)" : "100%", // Row layout (md+): Adjust width based on sidebar
    },
  });

  // Define styles specifically for the "pet" mode
  const live2dPetStyle = {
    ...live2dBaseStyle,
    top: 0, // Override position for pet mode
    left: 0,
    width: "100vw", // Full viewport
    height: "100vh",
    zIndex: 15, // Higher zIndex for pet mode overlay
  };

  const isVrmModel = useMemo(() => {
    if (!modelInfo?.url) return false;
    if (modelInfo.renderer) {
      return String(modelInfo.renderer).toLowerCase() === "vrm";
    }
    return modelInfo.url.toLowerCase().endsWith(".vrm");
  }, [modelInfo]);

  // Video pose tracking currently only supports VRM avatars. Avoid mounting
  // MediaPipe for GLB/GLTF to prevent runtime errors and wasted work.
  const isVrmAvatarFile = useMemo(() => {
    if (!modelInfo?.url) return false;
    return modelInfo.url.toLowerCase().endsWith(".vrm");
  }, [modelInfo?.url]);

  const hasModelUrl = Boolean(modelInfo?.url);

  return (
    <>
      <Box
        ref={live2dContainerRef}
        // Apply styles conditionally based on mode
        // Use the function to get dynamic responsive styles for window mode
        {...(mode === "window"
          ? getResponsiveLive2DWindowStyle(showSidebar)
          : live2dPetStyle)}
      >
        {!hasModelUrl ? null : isVrmModel ? (
          <>
            <VrmViewer showControls={showFloatingControls} />
            {isVrmAvatarFile ? (
              <MediaPipeController showControls={showFloatingControls} />
            ) : null}
          </>
        ) : (
          <Live2D />
        )}
      </Box>

      {/* Conditional Rendering of Window UI */}
      {mode === "window" && (
        <>
          {isElectron && <TitleBar />}
          {isSmallScreen && !showSidebar && (
            <Box
              position="fixed"
              top={isElectron ? "40px" : "10px"}
              left="10px"
              zIndex={100}
              bg="gray.800"
              p={2}
              borderRadius="md"
              cursor="pointer"
              onClick={() => setShowSidebar(true)}
              _hover={{ bg: "gray.700" }}
              border="1px solid"
              borderColor="whiteAlpha.200"
              boxShadow="lg"
            >
              <FiMenu size={20} />
            </Box>
          )}
          {/* Apply styles by spreading */}
          <Flex {...layoutStyles.appContainer}>
            <Box
              {...layoutStyles.sidebar}
              {...(isSmallScreen 
                ? { 
                    position: 'fixed', 
                    top: isElectron ? '30px' : '0', 
                    left: 0, 
                    height: isElectron ? 'calc(100% - 30px)' : '100%',
                    zIndex: 200,
                    display: showSidebar ? 'block' : 'none',
                    width: '100%',
                    maxWidth: '300px'
                  } 
                : { width: showSidebar ? "440px" : "24px" }
              )}
            >
              <Sidebar
                isCollapsed={!showSidebar}
                onToggle={() => setShowSidebar(!showSidebar)}
              />
            </Box>
            <Box {...layoutStyles.mainContent} ml={!isSmallScreen && showSidebar ? "0" : "0"}>
              <Background />
              {showFloatingControls && (
                <Box position="absolute" top="20px" left="20px" zIndex={10}>
                  <WebSocketStatus />
                </Box>
              )}
              <Box
                position="absolute"
                bottom={isFooterCollapsed ? "39px" : "135px"}
                left="50%"
                transform="translateX(-50%)"
                zIndex={10}
                width="60%"
              >
                <Subtitle />
              </Box>
              <Box
                {...layoutStyles.footer}
                zIndex={10}
                {...(isFooterCollapsed && layoutStyles.collapsedFooter)}
              >
                <Footer
                  isCollapsed={isFooterCollapsed}
                  onToggle={() => setIsFooterCollapsed(!isFooterCollapsed)}
                  showFloatingControls={showFloatingControls}
                  onToggleFloatingControls={() => setShowFloatingControls((value) => !value)}
                />
              </Box>
            </Box>
          </Flex>
        </>
      )}

      {/* Conditional Rendering of Pet Mode UI */}
      {mode === "pet" && (
        <InputSubtitle
          showFloatingControls={showFloatingControls}
          onToggleFloatingControls={() => setShowFloatingControls((value) => !value)}
        />
      )}
    </>
  );
}

function App(): JSX.Element {
  return (
    <ChakraProvider value={defaultSystem}>
      {/* ModeProvider needs to wrap AppContent to provide mode to getGlobalStyles */}
      <ModeProvider>
        <AppWithGlobalStyles />
      </ModeProvider>
    </ChakraProvider>
  );
}

// New component to access mode for global styles
function AppWithGlobalStyles(): JSX.Element {
  return (
    <>
      <CameraProvider>
        <ScreenCaptureProvider>
          <CharacterConfigProvider>
            <ChatHistoryProvider>
              <AiStateProvider>
                <ProactiveSpeakProvider>
                  <Live2DConfigProvider>
                    <SubtitleProvider>
                      <VADProvider>
                        <BgUrlProvider>
                          <GroupProvider>
                            <BrowserProvider>
                              <WebSocketHandler>
                                <Toaster />
                                <ErrorBoundary>
                                  <AppContent />
                                </ErrorBoundary>
                              </WebSocketHandler>
                            </BrowserProvider>
                          </GroupProvider>
                        </BgUrlProvider>
                      </VADProvider>
                    </SubtitleProvider>
                  </Live2DConfigProvider>
                </ProactiveSpeakProvider>
              </AiStateProvider>
            </ChatHistoryProvider>
          </CharacterConfigProvider>
        </ScreenCaptureProvider>
      </CameraProvider>
    </>
  );
}

export default App;
