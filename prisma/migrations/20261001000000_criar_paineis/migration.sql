-- CreateEnum
CREATE TYPE "status_agendamento" AS ENUM ('agendado', 'em_andamento', 'concluido', 'cancelado');

-- CreateTable
CREATE TABLE "creche" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "telefone" TEXT,
    "capacidade" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculo_profissional" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "creche_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculo_profissional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet" (
    "id" SERIAL NOT NULL,
    "tutor_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "raca" TEXT NOT NULL,
    "idade" INTEGER NOT NULL,
    "castrado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacina" (
    "id" SERIAL NOT NULL,
    "pet_id" INTEGER NOT NULL,
    "produto" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vacina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamento" (
    "id" SERIAL NOT NULL,
    "pet_id" INTEGER NOT NULL,
    "creche_id" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fim" TEXT NOT NULL,
    "status" "status_agendamento" NOT NULL DEFAULT 'agendado',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividade" (
    "id" SERIAL NOT NULL,
    "agendamento_id" INTEGER NOT NULL,
    "profissional_id" INTEGER,
    "descricao" TEXT NOT NULL,
    "registrada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creche_nome_key" ON "creche"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "vinculo_profissional_usuario_id_key" ON "vinculo_profissional"("usuario_id");

-- CreateIndex
CREATE INDEX "vinculo_profissional_creche_id_idx" ON "vinculo_profissional"("creche_id");

-- CreateIndex
CREATE INDEX "pet_tutor_id_idx" ON "pet"("tutor_id");

-- CreateIndex
CREATE INDEX "vacina_pet_id_idx" ON "vacina"("pet_id");

-- CreateIndex
CREATE INDEX "agendamento_creche_id_data_idx" ON "agendamento"("creche_id", "data");

-- CreateIndex
CREATE INDEX "agendamento_pet_id_idx" ON "agendamento"("pet_id");

-- CreateIndex
CREATE INDEX "atividade_agendamento_id_idx" ON "atividade"("agendamento_id");

-- AddForeignKey
ALTER TABLE "vinculo_profissional" ADD CONSTRAINT "vinculo_profissional_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculo_profissional" ADD CONSTRAINT "vinculo_profissional_creche_id_fkey" FOREIGN KEY ("creche_id") REFERENCES "creche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet" ADD CONSTRAINT "pet_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacina" ADD CONSTRAINT "vacina_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_creche_id_fkey" FOREIGN KEY ("creche_id") REFERENCES "creche"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividade" ADD CONSTRAINT "atividade_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividade" ADD CONSTRAINT "atividade_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
