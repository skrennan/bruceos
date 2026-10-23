const path=require('path');
const readline=require('readline/promises');
const {Writable}=require('stream');
const {createAccounts}=require('./accounts');

(async()=>{
    const accounts=await createAccounts(path.join(process.env.DATA_DIR||path.join(__dirname,'data'),'accounts.sqlite'));
    if(await accounts.initialized()){console.log('O administrador já existe. Use o painel para cadastrar novas lojas.');await accounts.close();return;}
    let hidden=false;
    const output=new Writable({write(chunk,encoding,done){if(!hidden)process.stdout.write(chunk);done();}});
    const rl=readline.createInterface({input:process.stdin,output,terminal:process.stdin.isTTY});
    try {
        console.log('Administrador inicial — os dados existentes serão vinculados à sua loja.');
        const name=(await rl.question('Nome da loja [Bruce Cell]: ')).trim()||'Bruce Cell';
        const email=await rl.question('E-mail do administrador: ');
        process.stdout.write('Senha (mínimo 12 caracteres; não será exibida): ');hidden=true;
        const password=await rl.question('');hidden=false;process.stdout.write('\n');
        process.stdout.write('Repita a senha: ');hidden=true;
        const confirmation=await rl.question('');hidden=false;process.stdout.write('\n');
        if(password!==confirmation)throw new Error('As senhas não coincidem.');
        await accounts.createStore({name,email,password,initial:true});
        console.log('Administrador criado. Inicie o servidor e entre com seu e-mail e senha.');
    } finally {rl.close();await accounts.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
