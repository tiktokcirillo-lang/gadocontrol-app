# GadoControl — CLAUDE.md

## Produto
Sistema de gestão de gado de corte para pequenos e médios produtores rurais brasileiros.
Foco em acessibilidade e preço competitivo frente às plataformas caras do mercado.

## Stack
- Next.js + TypeScript + Tailwind CSS
- Firebase (Firestore como banco de dados)
- Firebase Auth (Google OAuth + email/senha)
- Vercel (deploy)

## Regras de trabalho
- Edições cirúrgicas apenas — nunca reescrever arquivo inteiro sem solicitação explícita
- Sempre usar TypeScript estrito — sem `any`
- Componentes em `/components`, lógica de negócio em `/lib` ou `/hooks`
- Nunca alterar regras de segurança do Firebase sem instrução explícita
- Não instalar dependências novas sem avisar e justificar
- Commits em português, mensagens curtas e descritivas

## O que NÃO fazer
- Não mexer em configurações de autenticação sem pedido direto
- Não alterar `next.config.ts`, `tsconfig.json` ou `firebase` config sem permissão
- Não criar arquivos fora da estrutura existente do projeto

## Repositório
- GitHub: https://github.com/tiktokcirillo-lang/gadocontrol-app
- Branch principal: main
- Todo módulo concluído deve ter commit com mensagem descritiva em português
- Sempre fazer `git push origin main` após o commit