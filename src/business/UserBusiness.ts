import { UserDatabase } from "../database/UserDatabase"
import { LoginInputDTO, LoginOutputDTO, SignupInputDTO, SignupOutputDTO } from "../dtos/userDTO";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import { User } from "../models/User";
import { HashManager } from "../services/HashManager";
import { IdGenerator } from "../services/IdGenerator";
import { TokenManager } from "../services/TokenManager";
import { TokenPayload, UserDB, USER_ROLES } from "../types";

export class UserBusiness {
    constructor(
        private userDatabase: UserDatabase,
        private idGenerator: IdGenerator,
        private tokenManager: TokenManager,
        private hashManager: HashManager
    ) {}

    public signup = async (input: SignupInputDTO): Promise<SignupOutputDTO> => {
        const {name, email, password} = input

        if(typeof name !== "string") {
            throw new BadRequestError("'name' deve ser string")
        }
        if(typeof email !== "string") {
            throw new BadRequestError("'email' deve ser string")
        }
        if(typeof password !== "string") {
            throw new BadRequestError("'password' deve ser string")
        }

        const hashedPassword = await this.hashManager.hash(password)

        const newUser = new User(
            this.idGenerator.generate(),
            name,
            email,
            hashedPassword,
            USER_ROLES.NORMAL,
            new Date().toISOString()
        )
        
        const userDB = newUser.toDBModel()

        console.log(userDB)

        await this.userDatabase.singUp(userDB)

        const payload: TokenPayload = {
            id: newUser.getId(),
            name: newUser.getName(),
            role: newUser.getRole()
        }
        const token = this.tokenManager.createToken(payload)
        const output: SignupOutputDTO = {
            token
        }

        return output
    }

    public login = async (input: LoginInputDTO) => {
        const { email, password } = input

        if(typeof email !== "string") {
            throw new BadRequestError("'email' deve ser string")
        }
        if(typeof password !== "string") {
            throw new BadRequestError("'password' deve ser string")
        }

        const findUserDB: UserDB | undefined = await this.userDatabase.findByEmail(email) 

        if(!findUserDB) {
            throw new NotFoundError("Usuário não encontrado")
        }

        const user = new User(
            findUserDB.id,
            findUserDB.name,
            findUserDB.email,
            findUserDB.password,
            findUserDB.role,
            findUserDB.created_at
        )

        const verifyPassword = await this.hashManager.compare(password, user.getPassword())

        if(!verifyPassword) {
            throw new BadRequestError("'password' incorreta")
        }

        const payload: TokenPayload = {
            id: user.getId(),
            name: user.getName(),
            role: user.getRole()
        }
        const token = this.tokenManager.createToken(payload)

        const output: LoginOutputDTO = {
            token
        }

        return output
    }
}