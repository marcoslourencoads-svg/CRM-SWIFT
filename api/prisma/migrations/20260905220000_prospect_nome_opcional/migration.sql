-- O nome do prospect deixa de ser obrigatorio.
--
-- Em prospeccao fria muitas vezes so se tem o @ do perfil, ou so o
-- telefone que veio de uma indicacao. Exigir o nome fazia o operador
-- inventar um ("Contato 1") so para conseguir salvar — o que polui a
-- base e nao ajuda ninguem.
--
-- No lugar disso, a regra passou para o servico: pelo menos UM
-- identificador (nome, negocio, @, telefone ou e-mail) precisa vir
-- preenchido. Isso nao cabe em NOT NULL de coluna, porque e uma
-- condicao entre varias colunas.

-- AlterTable
ALTER TABLE "prospects" ALTER COLUMN "name" DROP NOT NULL;
