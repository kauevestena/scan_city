import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('mostra o título e a versão na tela de boot', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Scan City' })).toBeInTheDocument();
    expect(screen.getByTestId('app-version')).toHaveTextContent(/Versão \d+\.\d+\.\d+/);
  });
});
