'use strict';

/* -------------------------------------
 * Constants:
 * ------------------------------------- */
/* A custom event for when a user sends input to the console. */
const inputReceived = new Event('input-received');

/* The console prompt string: */
const promptMessage = '=^-x-^= $ ';

/* Console: */
const consoleBox  = document.getElementById('console');
const input       = document.getElementById('console-input');
const lines       = document.getElementById('console-lines');
const projectName = document.getElementById('project-name');

/* Buttons: */
const arrowButton     = document.getElementById('console-arrow');
const paperclipButton = document.getElementById('console-paperclip');

/* Background: */
const catBackground = document.getElementById('cat-background');
const imageCredits  = document.getElementById('image-credits');

/* Settings menu : */
const settings = document.getElementById('menu-settings');

/* Settings options: */
const promptColor       = document.getElementById('select-color');
const hidePrompt        = document.getElementById('hide-prompt');
const showHighlight     = document.getElementById('show-highlight');
const consoleOpacity    = document.getElementById('select-opacity');
const selectBackground  = document.getElementById('select-background');

/* -------------------------------------
 * Console functionality:
 * ------------------------------------- */
const createPrompt = () => {
  const span = document.createElement('span');
  span.style.color = promptColor.value;
  span.classList.add('console__prompt');
  span.appendChild(document.createTextNode(promptMessage));
  return span;
}

const addLine = (text, fromUser = true) => {
  const line = document.createElement('li');
  if (fromUser && !hidePrompt.checked) {
    line.appendChild(createPrompt());
  }
  line.appendChild(document.createTextNode(text));

  lines.appendChild(line);
  fixScroll();
}

const addError = text => {
  const line = document.createElement('li');
  line.style.color = '#c90e17';
  line.appendChild(document.createTextNode(`[Console] ${text}`));
  lines.appendChild(line);
  fixScroll();
};

const fixScroll = () => {
  const parent = lines.parentNode;
  parent.scrollTop = parent.scrollHeight;
}

const enableButtons = enable => {
  if (enable) {
    arrowButton.classList.add('enabled');
    paperclipButton.classList.add('enabled');
  }
  else {
    arrowButton.classList.remove('enabled');
    paperclipButton.classList.remove('enabled');
  }
};

const getInput = () => {
  input.disabled = false;
  input.focus();
  enableButtons(true);

  return new Promise(resolve => {
    input.addEventListener(
      'input-received',
      () => {
        const text = input.value;
        input.value = '';
        input.disabled = true;
        enableButtons(false);

        addLine(text);
        resolve(text);
      }, 
      { once: true }
    );
  });
}

const clearConsole = () => {
  lines.replaceChildren();
};

const toggleHighlight = highlight => {
  if (highlight)
    input.classList.add('console__input--highlight');
  else
    input.classList.remove('console__input--highlight');
};

const setOpacity = value => {
  consoleBox.style.opacity = `${value}%`;
};

const setProjectName = name => {
  if (name === '') return;
  projectName.textContent = name;
};

/* Set console background to an image in the server, asynchronously. */
const setBackground = path => fetch(path)
  .then(response => response.blob())
  .then(blob => {
    catBackground.style.backgroundImage = `url('${URL.createObjectURL(blob)}')`;
    imageCredits.classList.add('hide');
  });

/* Set console background to an image in the local filesystem. */
const setBackgroundLocal = file => {
  const url = URL.createObjectURL(file);
  catBackground.style.backgroundImage = `url('${url}')`;
  imageCredits.classList.add('hide');
};

const obscureOverlay = () => {
  const div = document.createElement('div');
  div.classList.add('screen-overlay', 'obscure');
  return div;
}

  /* -------------------------------------
 * Events:
 * ------------------------------------- */
input.addEventListener('keyup', event => {
  if (event.key !== 'Enter' || input.value === '') return;
  input.dispatchEvent(inputReceived);
});

arrowButton.addEventListener('click', () => {
  if (input.disabled || input.value === '') return;
  input.dispatchEvent(inputReceived);
});

paperclipButton.addEventListener('click', () => {
  if (input.disabled || input.value === '') return;
  // todo
});

document.getElementById('show-settings').addEventListener('click', () => {
  settings.classList.remove('hide');
  document.body.appendChild(obscureOverlay());
});

document.getElementById('hide-settings').addEventListener('click', () => {
  settings.classList.add('hide');
  Array.from(document.getElementsByClassName('obscure')).forEach(x => x.remove());
});

consoleOpacity.addEventListener('change', () => {
  setOpacity(consoleOpacity.value);
});

showHighlight.addEventListener('change', () => {
  toggleHighlight(showHighlight.checked);
});

selectBackground.addEventListener('change', () => {
  if (selectBackground.files.length === 0) return;
  setBackgroundLocal(selectBackground.files[0]);
});

/* -------------------------------------
 * Initialize:
 * ------------------------------------- */
setOpacity(consoleOpacity.value);
toggleHighlight(showHighlight.checked);

/* -------------------------------------
 * Standard library:
 * ------------------------------------- */
Mewlix.meow = message => {
  const str = Mewlix.purrify(message);
  addLine(str, false);
  return str;
};

Mewlix.listen = question => {
  if (!Mewlix.isNothing(question)) {
    addLine(Mewlix.purrify(question), false);
  }
  return getInput();
};

const ensure = Mewlix.ensure;

Mewlix.Console = Mewlix.library('std.console', {
  /* Clear console.
   * type: nothing */
  clear: clearConsole,

  /* Set console project name.
   * type: string -> nothing */
  name: name => {
    ensure.string(name);
    setProjectName(name);
  },

  /* Set console background image.
   * This function expects a valid path to an image file.
   *
   * type: string -> nothing */
  background: async path => {
    ensure.string(path);
    await setBackground(path);
  },

  /* Set console opacity level.
   *
   * Only values between 0 and 100 are accepted.
   * Any value outside of the accepted range will be clamped.
   *
   * type: number -> nothing */
  opacity: value => {
    const clamped = Mewlix.clamp(value, 0, 100);
    consoleOpacity.value = clamped.toString();
    setOpacity(clamped);
  },

  /* Toggle the console input box's 'highlight' behavior.
   * This is an accessibility feature!
   *
   * type: boolean -> nothing */
  highlight: enable => {
    showHighlight.checked = enable;
    toggleHighlight(enable);
  },

  /* Set console prompt color.
   * This function expects a valid hex code as argument!
   *
   * type: string -> nothing */
  prompt_color: color => {
    ensure.string(color);
    promptColor.value = color;
  },

  /* Sets whether or not to show the console prompt string before an user message.
   * type: boolean -> nothing */
  hide_prompt: hide => {
    ensure.boolean(hide);
    hidePrompt.checked = hide;
  },
});

export { addLine, addError };
