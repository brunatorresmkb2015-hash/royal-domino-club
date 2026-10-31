# Royal Domino Club — versão inicial multiplayer

## O que está incluído
- Salas privadas com código de 6 caracteres.
- Até 4 jogadores reais, em dispositivos diferentes.
- Chat em tempo real.
- Modo individual ou duplas (estrutura inicial).
- Série configurável de 4 a 8 partidas.
- Compra do monte, passar, pontuação e revanche.
- Interface responsiva com tema de cassino.

## Como executar no computador
1. Instale Node.js 18 ou superior.
2. Extraia a pasta do projeto.
3. Abra um terminal dentro da pasta e execute `npm install`.
4. Execute `npm start`.
5. Acesse `http://localhost:3000`.

Para amigos em outros aparelhos, publique a pasta em um serviço que aceite aplicações Node.js (por exemplo, Render ou Railway). Depois compartilhe o endereço público e o código da sala.

## Limitações desta versão inicial
Este é um protótipo funcional de sala e comunicação, não uma versão final validada de todas as regras de campeonato. A opção de bots está apenas sinalizada e ainda não cria jogadores automáticos. A regra de pontuação em duplas e a distribuição/ordem de saída precisam de revisão antes de uso competitivo. As salas ficam em memória: reiniciar o servidor encerra as salas. Use HTTPS em produção e adicione persistência, reconexão segura e validação adicional antes de abrir ao público.
