import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, MercuriusDriverConfig } from '@nestjs/mercurius';
import * as path from 'path';
import { CatalogResolver } from './resolvers/catalog.resolver';
import { UserResolver } from './resolvers/user.resolver';
import { PlaybackResolver } from './resolvers/playback.resolver';
import { SubscriptionResolver } from './resolvers/subscription.resolver';

@Module({
  imports: [
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      autoSchemaFile: path.join(process.cwd(), 'schema.gql'),
      graphiql: true,
      path: '/graphql',
      subscription: false,
      context: (req: any, reply: any) => ({
        req,
        reply,
        user: req?.user,
      }),
    }),
  ],
  providers: [
    CatalogResolver,
    UserResolver,
    PlaybackResolver,
    SubscriptionResolver,
  ],
})
export class AppGraphqlModule {}

