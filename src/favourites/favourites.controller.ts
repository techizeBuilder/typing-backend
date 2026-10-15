import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FavouritesService } from './favourites.service';

// The signed-in user's own favourites and folders ("My Dictations").
@Controller('favourites')
@UseGuards(JwtAuthGuard)
export class FavouritesController {
  constructor(private readonly favourites: FavouritesService) {}

  @Get()
  mine(@Request() req) {
    return this.favourites.getMine(req.user.userId);
  }

  @Post('chapters/:chapterId')
  add(@Request() req, @Param('chapterId') chapterId: string) {
    return this.favourites.addFavourite(req.user.userId, chapterId);
  }

  @Delete('chapters/:chapterId')
  remove(@Request() req, @Param('chapterId') chapterId: string) {
    return this.favourites.removeFavourite(req.user.userId, chapterId);
  }

  @Post('folders')
  createFolder(@Request() req, @Body() body: any) {
    return this.favourites.createFolder(req.user.userId, body?.name);
  }

  @Patch('folders/:id')
  renameFolder(@Request() req, @Param('id') id: string, @Body() body: any) {
    return this.favourites.renameFolder(req.user.userId, id, body?.name);
  }

  @Delete('folders/:id')
  deleteFolder(@Request() req, @Param('id') id: string) {
    return this.favourites.deleteFolder(req.user.userId, id);
  }

  @Post('folders/:id/chapters/:chapterId')
  addToFolder(@Request() req, @Param('id') id: string, @Param('chapterId') chapterId: string) {
    return this.favourites.addToFolder(req.user.userId, id, chapterId);
  }

  @Delete('folders/:id/chapters/:chapterId')
  removeFromFolder(@Request() req, @Param('id') id: string, @Param('chapterId') chapterId: string) {
    return this.favourites.removeFromFolder(req.user.userId, id, chapterId);
  }
}
