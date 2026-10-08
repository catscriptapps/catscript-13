<?php
// /resources/views/components/scroll-top.php
// This component adds a "Scroll to Top" button that appears when the user scrolls down the page.
?>

<button
  id="scroll-top"
  aria-label="Scroll to top"
  style="
  position: fixed;
  /* Bottom-right corner. While it shows, the live-chat bubble (h-14,
     components/chat-widget.php) lifts to sit above it (app.css). The 44px
     button is centred under the 56px bubble: right 24px + (56 - 44) / 2. */
  bottom: 24px;
  right: 30px;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  border-radius: 9999px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  background-color: #f97316;
  color: white;
  opacity: 0;
  pointer-events: none;
  transition: background-color 0.3s ease, transform 0.3s ease;
 "
  onmouseover="this.style.backgroundColor='#ea580c'; this.style.transform='scale(1.1)'"
  onmouseout="this.style.backgroundColor='#f97316'; this.style.transform='scale(1)'">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
    <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
  </svg>
</button>