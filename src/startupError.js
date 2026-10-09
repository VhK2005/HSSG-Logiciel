export function renderStartupError(error) {
  const root = document.getElementById('root');
  if (!root) return;

  const panel = document.createElement('div');
  panel.className = 'startup-error';
  const heading = document.createElement('h1');
  heading.textContent = 'Vice Versa — Carnet de consignes';
  const message = document.createElement('p');
  message.textContent = 'Le chargement de l’application a été interrompu. Rechargez la page ou contactez votre administrateur.';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Recharger';
  button.addEventListener('click', () => window.location.reload());
  panel.append(heading, message, button);
  root.replaceChildren(panel);
}

