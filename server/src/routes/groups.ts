import { Router } from 'express';

import { addMember, createGroup, removeMember, updateGroup } from '../services/groupService';
import { asObject, parseGroupSettings, parseIdList, requireId } from '../validation';

export const groupsRouter = Router();

/** Cria um grupo; o usuário autenticado vira proprietário e integrante. */
groupsRouter.post('/', async (req, res) => {
  const body = asObject(req.body);
  const id = await createGroup(req.uid, parseGroupSettings(body), parseIdList(body.memberIds ?? [], 'memberIds'));
  res.status(201).json({ id });
});

/** Altera nome, foto, limite e/ou política de notificações (somente o proprietário). */
groupsRouter.patch('/:groupId', async (req, res) => {
  await updateGroup(req.uid, requireId(req.params.groupId, 'groupId'), parseGroupSettings(asObject(req.body)));
  res.json({ status: 'updated' });
});

/** Adiciona um integrante respeitando o limite configurado (somente o proprietário). */
groupsRouter.post('/:groupId/members', async (req, res) => {
  const memberId = requireId(asObject(req.body).memberId, 'memberId');
  await addMember(req.uid, requireId(req.params.groupId, 'groupId'), memberId);
  res.json({ status: 'added' });
});

/** Remove um integrante e revoga o acesso dele às mensagens (somente o proprietário). */
groupsRouter.delete('/:groupId/members/:memberId', async (req, res) => {
  await removeMember(req.uid, requireId(req.params.groupId, 'groupId'), requireId(req.params.memberId, 'memberId'));
  res.json({ status: 'removed' });
});
