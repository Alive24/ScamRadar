chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SCAMRADAR_GET_PAGE_CONTEXT") return false;

  sendResponse({
    url: location.href,
    title: document.title,
    selectedText: window.getSelection()?.toString() ?? ""
  });

  return true;
});
