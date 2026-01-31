'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .highlight { position: relative; }
    .copy-code-button {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      background: transparent;
      border: 1px solid rgba(128, 128, 128, 0.4);
      border-radius: 4px;
      cursor: pointer;
      padding: 4px;
      line-height: 0;
      color: inherit;
      opacity: 0.7;
      transition: opacity 0.2s, background-color 0.2s;
      z-index: 10;
    }
    .copy-code-button:hover {
      opacity: 1;
      background: rgba(128, 128, 128, 0.1);
    }
    .copy-code-button:focus {
      opacity: 1;
      outline: 2px solid #007bff;
      outline-offset: 2px;
    }
    .copy-code-button svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
  `;
  document.head.appendChild(style);

  // Icons
  const clipboardIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
      <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
    </svg>
  `;

  const checkIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
    </svg>
  `;

  // Add buttons to code blocks
  // Use pre.highlight to find the actual code blocks, then find the closest wrapper
  const codeBlocks = document.querySelectorAll('pre.highlight');
  codeBlocks.forEach((pre) => {
    const block = pre.closest('div.highlight');
    // If no wrapper, skip (or handle differently, but standard usage has wrapper)
    if (!block) return;

    // Check if button already exists in this block
    if (block.querySelector('.copy-code-button')) return;

    const button = document.createElement('button');
    button.className = 'copy-code-button';
    button.ariaLabel = 'Copy code to clipboard';
    button.innerHTML = clipboardIcon;

    button.addEventListener('click', () => {
      const code = block.querySelector('code');
      const text = code ? code.innerText : block.innerText;

      navigator.clipboard.writeText(text).then(
        () => {
          button.innerHTML = checkIcon;
          button.ariaLabel = 'Copied!';
          setTimeout(() => {
            button.innerHTML = clipboardIcon;
            button.ariaLabel = 'Copy code to clipboard';
          }, 2000);
        },
        (err) => {
          console.error('Failed to copy text: ', err);
        }
      );
    });

    block.appendChild(button);
  });
});
