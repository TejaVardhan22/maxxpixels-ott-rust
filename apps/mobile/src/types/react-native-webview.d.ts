declare module 'react-native-webview' {
  import * as React from 'react';
  import { ViewProps } from 'react-native';

  export interface WebViewNavigation {
    url: string;
    title: string;
    loading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
  }

  export interface WebViewMessageEvent {
    nativeEvent: { data: string };
  }

  export interface WebViewHttpErrorEvent {
    nativeEvent: { statusCode: number; url: string };
  }

  export interface ShouldStartLoadRequest {
    url: string;
    isTopFrame: boolean;
    navigationType?: string;
  }

  export interface WebViewProps extends ViewProps {
    source?: { uri?: string; html?: string; headers?: Record<string, string> };
    cacheMode?: 'LOAD_DEFAULT' | 'LOAD_CACHE_ELSE_NETWORK' | 'LOAD_NO_CACHE' | 'LOAD_CACHE_ONLY';
    javaScriptEnabled?: boolean;
    domStorageEnabled?: boolean;
    thirdPartyCookiesEnabled?: boolean;
    mixedContentMode?: 'never' | 'always' | 'compatibility';
    allowsInlineMediaPlayback?: boolean;
    mediaPlaybackRequiresUserAction?: boolean;
    allowsFullscreenVideo?: boolean;
    setSupportMultipleWindows?: boolean;
    originWhitelist?: string[];
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (e: any) => void;
    onHttpError?: (e: WebViewHttpErrorEvent) => void;
    onNavigationStateChange?: (nav: WebViewNavigation) => void;
    onShouldStartLoadWithRequest?: (req: ShouldStartLoadRequest) => boolean;
    onMessage?: (e: WebViewMessageEvent) => void;
    onRenderProcessGone?: (e: any) => void;
  }

  export class WebView extends React.Component<WebViewProps> {
    goBack(): void;
    goForward(): void;
    reload(): void;
    stopLoading(): void;
  }

  export default WebView;
}
