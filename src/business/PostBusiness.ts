import { PostDatabase } from "../database/PostDatabase";
import { LikeOrDislikeInputDTO } from "../dtos/likeDislikeDTO";
import { CreatePostInputDTO, GetPostByIdInputDTO, GetPostInputDTO, GetPostOutputDTO } from "../dtos/postDTO";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import { Post } from "../models/Post";
import { IdGenerator } from "../services/IdGenerator";
import { TokenManager } from "../services/TokenManager";
import { LikesDislikesDB, PostDB, PostWithCreatorDB, POST_LIKE_DISLIKE } from "../types";

export class PostBusiness {
    constructor(
        private postDatabase: PostDatabase,
        private idGenerator: IdGenerator,
        private tokenManager: TokenManager
    ){}
    public getPost = async (input: GetPostInputDTO): Promise<GetPostOutputDTO> => {
        const { token } = input

        if(!token) {
            throw new BadRequestError("'token' precisa existir")
        }
        const payload = this.tokenManager.getPayload(token)
        if(payload === null){
            throw new BadRequestError("Token inválido")
        }
        const postsWithCreatorsDB: PostWithCreatorDB[] = await this.postDatabase.getPostsWithCreators()

        const posts = postsWithCreatorsDB.map(
            (postWithCreatorDB) => {
                const post = new Post(
                    postWithCreatorDB.id,
                    postWithCreatorDB.creator_id,
                    postWithCreatorDB.content,
                    postWithCreatorDB.likes,
                    postWithCreatorDB.dislikes,
                    postWithCreatorDB.replies,
                    postWithCreatorDB.created_at,
                    postWithCreatorDB.updated_at,
                    postWithCreatorDB.creator_name
                )

                return post.toBusinessModel()
            }
        )
        const output: GetPostOutputDTO = posts
        return output
    }

    public getPostById = async (input: GetPostByIdInputDTO): Promise<GetPostOutputDTO> => {
        const { postId, token } = input

        if(!token) {
            throw new BadRequestError("'token' precisa existir")
        }
        const payload = this.tokenManager.getPayload(token)
        if(payload === null){
            throw new BadRequestError("Token inválido")
        }
        const postsWithCreatorsDB: PostWithCreatorDB[] = await this.postDatabase.getPostsWithCreatorsById(postId)

        const posts = postsWithCreatorsDB.map(
            (postWithCreatorDB) => {
                const post = new Post(
                    postWithCreatorDB.id,
                    postWithCreatorDB.creator_id,
                    postWithCreatorDB.content,
                    postWithCreatorDB.likes,
                    postWithCreatorDB.dislikes,
                    postWithCreatorDB.replies,
                    postWithCreatorDB.created_at,
                    postWithCreatorDB.updated_at,
                    postWithCreatorDB.creator_name
                )

                return post.toBusinessModel()
            }
        )
        const output: GetPostOutputDTO = posts
        return output
    }

    public createPost = async (input: CreatePostInputDTO) => {
        const {token, content} = input

        if(!token) {
            throw new BadRequestError("'token' precisa existir")
        }   
        const payload = this.tokenManager.getPayload(token)
        if(payload === null) {
            throw new BadRequestError("Token inválido")
        }

        if(typeof content !== "string") {
            throw new BadRequestError("'content' precisa ser string")
        }

        const id = this.idGenerator.generate()
        const creatorId = payload.id
        const createdAt = new Date().toISOString()
        const updatedAt = new Date().toISOString()
        const creatorName = payload.name

        const post = new Post(
            id,
            creatorId,
            content,
            0,
            0,
            0,
            createdAt,
            updatedAt,
            creatorName
        )

        const postDB = post.toDBModel()

        await this.postDatabase.insert(postDB)
    }

    public likeOrDislikePost = async (input: LikeOrDislikeInputDTO): Promise<void> => {
        const {idToLikeOrDislike, token, like} = input

        if(!token) {
            throw new BadRequestError("'token' precisa existir")
        }
        const payload = this.tokenManager.getPayload(token)
        if(payload === null){
            throw new BadRequestError("'token' inválido")
        }

        if (typeof like !== "boolean") {
            throw new BadRequestError("'like' precisa ser booleano")
        }

        const postWithCreatorDB = await this.postDatabase.findPostWithCreatorById(idToLikeOrDislike)

        if(!postWithCreatorDB) {
            throw new NotFoundError("'id' não encontrado")
        }

        const userId = payload.id
        const likeConvertor = like ? 1 : 0

        const likeOrDislikeDB: LikesDislikesDB = {
            user_id: userId,
            post_id: postWithCreatorDB.id,
            like: likeConvertor
        }

        const verifyLikeDislike = await this.postDatabase.findLikeDislike(likeOrDislikeDB)

        const post = new Post(
            postWithCreatorDB.id,
            postWithCreatorDB.creator_id,
            postWithCreatorDB.content,
            postWithCreatorDB.likes,
            postWithCreatorDB.dislikes,
            postWithCreatorDB.replies,
            postWithCreatorDB.created_at,
            postWithCreatorDB.updated_at,
            postWithCreatorDB.creator_name,
        )

        if(verifyLikeDislike === POST_LIKE_DISLIKE.ALREADY_LIKED) {
            if(like) {
                await this.postDatabase.removeLikeOrDislike(likeOrDislikeDB)
                post.removeLike()
            } else {
                await this.postDatabase.updateLikeOrDislike(likeOrDislikeDB)
                post.removeLike()
                post.addDislike()
            }
        } else if(verifyLikeDislike === POST_LIKE_DISLIKE.ALREADY_DISLIKED) {
            if(like) {
                await this.postDatabase.updateLikeOrDislike(likeOrDislikeDB)
                post.removeDislike()
                post.addLike()
            } else {
                await this.postDatabase.removeLikeOrDislike(likeOrDislikeDB)
                post.removeDislike()
            }
        } else {
            await this.postDatabase.likeOrDislikePost(likeOrDislikeDB)
            like ? post.addLike() : post.addDislike()
        }

        const updatedPost = post.toDBModel()

        await this.postDatabase.update(idToLikeOrDislike, updatedPost)

    }  

}