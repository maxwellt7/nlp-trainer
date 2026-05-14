import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

const WIDGET_ID = '6a065982f7ab41a58ff36037';
const SCRIPT_ID = 'leadconnector-widget-loader';
const LOADER_SRC = 'https://widgets.leadconnectorhq.com/loader.js';
const RESOURCES_URL = 'https://widgets.leadconnectorhq.com/chat-widget/loader.js';

function injectWidget() {
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = LOADER_SRC;
  script.async = true;
  script.setAttribute('data-resources-url', RESOURCES_URL);
  script.setAttribute('data-widget-id', WIDGET_ID);
  document.body.appendChild(script);
}

function removeWidget() {
  document.getElementById(SCRIPT_ID)?.remove();
  document.querySelectorAll('chat-widget').forEach((el) => el.remove());
  document.querySelectorAll('iframe').forEach((iframe) => {
    if (iframe.src.includes('leadconnectorhq.com')) iframe.remove();
  });
  document.querySelectorAll('[class*="leadconnector" i], [id*="leadconnector" i]').forEach((el) => el.remove());
}

export default function LeadConnectorWidget() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      removeWidget();
    } else {
      injectWidget();
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    return () => removeWidget();
  }, []);

  return null;
}
