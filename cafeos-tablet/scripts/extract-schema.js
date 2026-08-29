const { PrismaClient } = require('../../my-app/lib/prisma-client')
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name
  `)
  result.forEach(r => console.log(r.sql + ';'))
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
