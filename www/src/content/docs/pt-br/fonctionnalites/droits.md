---
title: Permissões e grupos
description: Contas, grupos, níveis de acesso por projeto, base e tabela, restrições por campo e suas configurações.
---

As permissões são concedidas a **grupos**, nunca a pessoas uma a uma. Um nível
definido em um projeto, uma base ou uma tabela desce para tudo o que está
abaixo, inclusive o que for criado mais tarde.

## Os quatro níveis

| Nível | Permite |
|---|---|
| **Sem acesso** | nada: o recurso fica invisível |
| **Leitura** | ver as linhas, comentá-las, criar visões pessoais, consultar a estrutura e os painéis, fazer e salvar as próprias perguntas, escrever SQL somente para leitura e salvar suas consultas pessoais |
| **Edição** | e também criar, editar e excluir linhas |
| **Gerenciamento** | e também mudar a estrutura, criar as visões compartilhadas e os painéis, compartilhar um painel por um link, compartilhar perguntas e consultas, criar visões SQL, as automações, as integrações e os tokens; o SQL tem acesso à base inteira, inclusive escritas |

As permissões **se somam**: uma pessoa recebe o nível mais alto que um de
seus grupos lhe dá. Dar menos a uma tabela do que à base dela a torna “granular”.

Dois grupos sempre existem: **Administradores**, que gerenciam tudo, e **Todos os
usuários**, do qual toda conta faz parte — o que é concedido a ele, todo mundo tem.

## Até o campo

Abaixo da grade de níveis, **Campos** oculta uma coluna para um grupo ou a torna não editável
para ele. A tela também mostra o que uma determinada pessoa realmente vê, e por meio de qual grupo.

Um campo oculto está ausente em todo lugar: da grade, das visões, da API, do MCP, do histórico,
do SQL escrito na interface e das visões SQL. Filtrar ou ordenar por ele responde como para um campo
que não existe.

## Até a linha

Ao lado de **Campos**, **Linhas** mostra a um grupo apenas certas linhas de uma tabela: as
que um filtro retém, escrito como o de uma visão. `@me` designa a pessoa conectada:

- `commercial eq @me` — cada vendedor só vê seus clientes;
- `region in ["nord", "est"]` — uma equipe só vê suas regiões;
- `_created_by eq @me` — cada um só vê o que criou.

As permissões **se somam**: uma pessoa vê as linhas de todos os seus grupos, e um grupo sem
regra as vê todas. Quem gerencia a estrutura da tabela — o nível Gerenciamento — sempre vê tudo.
A tela informa quantas linhas uma determinada pessoa vê, e por qual grupo.

Uma linha fora da sua regra não existe para a pessoa: nem nas visões, nos painéis, na busca, na
API, no MCP ou no histórico, nem para ser alterada, excluída ou vinculada. Uma linha que ela cria
deve fazer parte das suas; ao alterar uma linha, ela pode, porém, fazê-la sair do seu perímetro —
uma tarefa confiada a um colega. As respostas aos
[formulários compartilhados](/basedb/pt-br/fonctionnalites/formulaires-partages/) sempre chegam.

## E o SQL?

Na interface, o SQL segue as mesmas permissões, aplicadas pelo próprio PostgreSQL: sem o nível
Gerenciamento, uma consulta é executada somente para leitura, em um papel exclusivo da pessoa, em que uma tabela
fechada não existe, um campo oculto é recusado e apenas suas linhas são lidas, seja a tabela
nomeada sozinha ou com seu esquema. Uma [visão SQL](/basedb/pt-br/fonctionnalites/requetes-et-vues-sql/)
é lida com as permissões de quem a lê, e compartilhar uma consulta compartilha apenas o texto dela.

Já um acesso **`psql` direto** ao banco não é controlado pelo basedb: ele lê tudo, inclusive campos
ocultos. As restrições protegem as superfícies do produto — interface, API, MCP —, nunca
contra alguém que tenha acesso SQL ao banco; esses acessos são configurados com `GRANT`
do PostgreSQL, definidos por quem opera a instância. Uma tabela que tem uma regra de linhas tem a
segurança por linha do PostgreSQL ativada: um papel criado para uma ferramenta terceira não vê
nenhuma linha nela, exceto se tiver o atributo `BYPASSRLS` ou sua própria política.

## Contas e login

- Uma conta é criada com uma **senha temporária**, mostrada uma vez e que deve ser trocada no
  primeiro login.
- O login é feito por senha ou por um provedor **OpenID Connect** declarado por
  quem opera a instância.
- As ações de administração exigem uma **sessão elevada**: uma senha digitada novamente nos
  últimos cinco minutos.
- As sessões podem ser revogadas; revogar uma sessão invalida na hora os tokens de acesso dela.

## Suas configurações

**Configurações**, no menu do perfil no canto inferior esquerdo, diz respeito só a você:

| Aba | O que se faz nela |
|---|---|
| **Perfil** | o nome exibido; o endereço de login; os provedores de identidade vinculados à conta, para vincular ou desvincular |
| **Segurança** | trocar a senha; as sessões abertas, para encerrar uma a uma ou todas |
| **Aparência** | o idioma da interface; o tema; a ordem das datas — `25/09/2026` ou `2026-09-25` — e o primeiro dia da semana dos calendários |
| **Notificações** | os tipos de notificação que você não quer mais receber |
| **Tokens** | os tokens de integração que você criou, em todas as suas bases, seu último uso e sua revogação |

O basedb fala **vinte idiomas**: francês, inglês, alemão, espanhol, italiano, português
(Brasil), neerlandês, polonês, tcheco, sueco, dinamarquês, norueguês, finlandês, romeno, húngaro,
turco, ucraniano, japonês, chinês simplificado e coreano. Por padrão, a interface usa o idioma
do seu navegador; **Idioma**, em **Aparência**, define outro. Os números e as datas
seguem o idioma escolhido.

Um link também pode pedir um idioma: `?lang=de` no final de um endereço do basedb exibe em
alemão a tela de login, um formulário, uma visão ou um painel compartilhados. É assim que o
site leva à demonstração no idioma da página. Depois de conectado, o basedb segue a sua conta:
o idioma escolhido em **Aparência**, senão o do navegador.

O tema fica vinculado ao navegador; o idioma, a ordem das datas e o primeiro dia da
semana acompanham você de um computador para outro. Mudar de endereço ou vincular um provedor exige uma sessão
elevada; uma conta sem senha, que entra por um provedor, mantém o endereço desse
provedor.

## O ponto único de aplicação

Todas as superfícies — interface, API, MCP, formulários e visões compartilhados, automações —
passam pelo mesmo ponto de decisão das permissões, no núcleo. Não existe rota
privada da interface: o que a tela não exibe é porque a API não o retornou.

O inverso também vale: a tela **não oferece o que seria recusado**. Sem o nível
Gerenciamento, a tela Estrutura pode ser consultada sem botão nem lápis, e a importação não oferece
criar uma tabela; sem a permissão de criar ou excluir linhas, a grade não oferece nem linha
de adição nem “Excluir”.
