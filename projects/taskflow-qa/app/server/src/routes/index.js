import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from './auth.js';
import { projectsRouter } from './projects.js';
import { membersRouter } from './members.js';
import { projectTasksRouter, tasksRouter } from './tasks.js';
import { projectActivityRouter } from './activity.js';
import { reportsRouter } from './reports.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/projects/:projectId/members', membersRouter);
apiRouter.use('/projects/:projectId/tasks', projectTasksRouter);
apiRouter.use('/projects/:id/activity', projectActivityRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/reports', reportsRouter);
